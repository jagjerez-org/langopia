import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorState, Skeleton, Table, Tag } from "../../ui/index.js";
import type { TableColumn, TagVariant } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatPercent } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import {
  defaultAnalyticsRange,
  getNps,
  getStudentsAtRisk,
  getTeacherProductivity,
  getTeacherQuality,
  listMcpAuthorizations,
  revokeMcpAuthorization,
} from "./api.js";
import type {
  ChurnRiskReason,
  McpAuthorizationView,
  StudentAtRiskView,
  TeacherProductivityView,
} from "./api.js";

const RISK_VARIANT: Record<StudentAtRiskView["level"], TagVariant> = {
  low: "neutral",
  medium: "warning",
  high: "critical",
};

const MCP_VARIANT: Record<McpAuthorizationView["status"], TagVariant> = {
  active: "success",
  expired: "warning",
  revoked: "neutral",
};

export function AnalyticsScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const range = useMemo(() => defaultAnalyticsRange(), []);

  const npsQuery = useQuery({ queryKey: ["analytics", "nps", range], queryFn: () => getNps(range) });
  const qualityQuery = useQuery({
    queryKey: ["analytics", "teacher-quality", range],
    queryFn: () => getTeacherQuality(range),
  });
  const riskQuery = useQuery({ queryKey: ["analytics", "students-at-risk"], queryFn: getStudentsAtRisk });
  const productivityQuery = useQuery({
    queryKey: ["analytics", "teacher-productivity", range],
    queryFn: () => getTeacherProductivity(range),
  });
  const mcpQuery = useQuery({ queryKey: ["analytics", "mcp-authorizations"], queryFn: listMcpAuthorizations });

  const failure =
    npsQuery.error ?? qualityQuery.error ?? riskQuery.error ?? productivityQuery.error ?? mcpQuery.error;

  return (
    <main className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t("analytics.title")}</h1>
      </div>

      {failure && (
        <ErrorState
          title={failure instanceof ApiError ? errorMessage(failure.problem) : t("analytics.errorTitle")}
          action={
            <Button
              onClick={() => {
                void npsQuery.refetch();
                void qualityQuery.refetch();
                void riskQuery.refetch();
                void productivityQuery.refetch();
                void mcpQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      )}

      {!failure && (
        <div className="flex flex-col gap-6">
          <SatisfactionSection
            isLoading={npsQuery.isPending || qualityQuery.isPending}
            nps={npsQuery.data}
            teachers={qualityQuery.data ?? []}
          />
          <RiskSection isLoading={riskQuery.isPending} rows={riskQuery.data ?? []} />
          <ProductivitySection isLoading={productivityQuery.isPending} rows={productivityQuery.data ?? []} />
          <McpSection
            isLoading={mcpQuery.isPending}
            rows={mcpQuery.data ?? []}
            onChanged={() => void mcpQuery.refetch()}
          />
        </div>
      )}
    </main>
  );
}

function SatisfactionSection({
  isLoading,
  nps,
  teachers,
}: {
  isLoading: boolean;
  nps: Awaited<ReturnType<typeof getNps>> | undefined;
  teachers: Awaited<ReturnType<typeof getTeacherQuality>>;
}): ReactElement {
  const t = useT();
  const locale = useLocale();
  const averageCsat =
    teachers.length === 0
      ? null
      : teachers.reduce((sum, row) => sum + (row.averageCsat ?? 0), 0) /
        Math.max(teachers.filter((row) => row.averageCsat !== null).length, 1);

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{t("analytics.satisfaction.title")}</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card title={t("analytics.satisfaction.nps")}>
          {isLoading ? (
            <Skeleton variant="text" lines={2} />
          ) : (
            <>
              <p className="text-2xl font-semibold">{nps?.score ?? "—"}</p>
              <p>{t("analytics.satisfaction.respondents", { count: nps?.respondents ?? 0 })}</p>
              <p>
                {t("analytics.satisfaction.evolution", {
                  promoters: nps?.promoters ?? 0,
                  passives: nps?.passives ?? 0,
                  detractors: nps?.detractors ?? 0,
                })}
              </p>
            </>
          )}
        </Card>
        <Card title={t("analytics.satisfaction.csat")}>
          {isLoading ? (
            <Skeleton variant="text" lines={2} />
          ) : (
            <>
              <p className="text-2xl font-semibold">
                {averageCsat === null ? "—" : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(averageCsat)}
              </p>
              <p>{t("analytics.satisfaction.teacherRows", { count: teachers.length })}</p>
              {teachers.slice(0, 3).map((row) => (
                <p key={row.teacherProfileId}>
                  {row.teacherName}: {row.averageCsat ?? "—"} · {t("analytics.satisfaction.pendingReviews", { count: row.negativeReviewsPending })}
                </p>
              ))}
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function RiskSection({ isLoading, rows }: { isLoading: boolean; rows: StudentAtRiskView[] }): ReactElement {
  const t = useT();
  const locale = useLocale();
  const columns = useMemo<TableColumn<StudentAtRiskView>[]>(
    () => [
      { key: "student", header: t("analytics.risk.columnStudent"), render: (row) => row.name },
      {
        key: "level",
        header: t("analytics.risk.columnLevel"),
        render: (row) => <Tag variant={RISK_VARIANT[row.level]}>{t(`analytics.risk.level.${row.level}`)}</Tag>,
      },
      {
        key: "score",
        header: t("analytics.risk.columnScore"),
        numeric: true,
        render: (row) => row.score,
      },
      {
        key: "reasons",
        header: t("analytics.risk.columnReasons"),
        render: (row) => <ReasonList row={row} />,
      },
      {
        key: "attendance",
        header: t("analytics.risk.columnAttendance"),
        numeric: true,
        render: (row) =>
          row.signals.attendanceRateLast4Weeks === null
            ? "—"
            : formatPercent(row.signals.attendanceRateLast4Weeks, locale),
      },
    ],
    [t, locale],
  );

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{t("analytics.risk.title")}</h2>
      <Table
        caption={t("analytics.risk.caption")}
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.studentId}
        isLoading={isLoading}
        emptyState={<EmptyState title={t("analytics.risk.emptyTitle")} description={t("analytics.risk.emptyDescription")} />}
      />
    </section>
  );
}

function ReasonList({ row }: { row: StudentAtRiskView }): ReactElement {
  const t = useT();
  return (
    <ul className="flex flex-col gap-1">
      {row.reasons.map((reason) => (
        <li key={reason}>{riskReasonLabel(t, reason, row)}</li>
      ))}
    </ul>
  );
}

function riskReasonLabel(t: ReturnType<typeof useT>, reason: ChurnRiskReason, row: StudentAtRiskView): string {
  if (reason === "consecutive_absences") {
    return t("analytics.risk.reason.consecutive_absences", { count: row.signals.consecutiveAbsences });
  }
  if (reason === "stale_evaluation") {
    return row.signals.weeksWithoutEvaluation === null
      ? t("analytics.risk.reason.stale_evaluation_never")
      : t("analytics.risk.reason.stale_evaluation", { weeks: row.signals.weeksWithoutEvaluation });
  }
  return t(`analytics.risk.reason.${reason}`);
}

function ProductivitySection({
  isLoading,
  rows,
}: {
  isLoading: boolean;
  rows: TeacherProductivityView[];
}): ReactElement {
  const t = useT();
  const locale = useLocale();
  const columns = useMemo<TableColumn<TeacherProductivityView>[]>(
    () => [
      { key: "teacher", header: t("analytics.productivity.columnTeacher"), render: (row) => row.teacherName },
      {
        key: "occupancy",
        header: t("analytics.productivity.columnOccupancy"),
        numeric: true,
        render: (row) => formatPercent(row.occupancyRate, locale),
      },
      {
        key: "students",
        header: t("analytics.productivity.columnStudentsWithoutEvaluation"),
        render: (row) => row.studentsWithoutEvaluationNames.join(", ") || "—",
      },
      {
        key: "quality",
        header: t("analytics.productivity.columnQuality"),
        render: (row) =>
          t("analytics.productivity.qualityDetail", {
            csat: row.averageCsat ?? "—",
            reviews: row.pendingNegativeMaterialReviews,
          }),
      },
      {
        key: "operations",
        header: t("analytics.productivity.columnOperations"),
        render: (row) =>
          t("analytics.productivity.operationsDetail", {
            late: row.lateStartedSessions,
            unsigned: row.unsignedCorrectionsOlderThan7Days,
          }),
      },
    ],
    [t, locale],
  );

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{t("analytics.productivity.title")}</h2>
      <Table
        caption={t("analytics.productivity.caption")}
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.teacherProfileId}
        isLoading={isLoading}
        emptyState={<EmptyState title={t("analytics.productivity.emptyTitle")} description={t("analytics.productivity.emptyDescription")} />}
      />
    </section>
  );
}

function McpSection({
  isLoading,
  rows,
  onChanged,
}: {
  isLoading: boolean;
  rows: McpAuthorizationView[];
  onChanged: () => void;
}): ReactElement {
  const t = useT();
  const [success, setSuccess] = useState(false);
  const mutation = useMutation({
    mutationFn: (authorizationId: string) => revokeMcpAuthorization(authorizationId),
    onSuccess: () => {
      setSuccess(true);
      onChanged();
    },
  });
  const columns = useMemo<TableColumn<McpAuthorizationView>[]>(
    () => [
      { key: "client", header: t("analytics.mcp.columnClient"), render: (row) => row.clientName },
      { key: "member", header: t("analytics.mcp.columnMember"), render: (row) => row.memberName },
      { key: "scopes", header: t("analytics.mcp.columnScopes"), render: (row) => row.scopes.join(", ") },
      {
        key: "status",
        header: t("analytics.mcp.columnStatus"),
        render: (row) => <Tag variant={MCP_VARIANT[row.status]}>{t(`analytics.mcp.status.${row.status}`)}</Tag>,
      },
      {
        key: "actions",
        header: t("analytics.mcp.columnActions"),
        render: (row) =>
          row.status === "active" ? (
            <Button
              variant="secondary"
              onClick={() => mutation.mutate(row.authorizationId)}
              isLoading={mutation.isPending}
              aria-label={t("analytics.mcp.revokeAria", { client: row.clientName })}
            >
              {t("analytics.mcp.revoke")}
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [t, mutation],
  );

  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{t("analytics.mcp.title")}</h2>
      {success && <p role="status">{t("analytics.mcp.revokeSuccess")}</p>}
      {mutation.error && (
        <p role="alert">
          {mutation.error instanceof ApiError ? mutation.error.problem.title : t("analytics.mcp.revokeError")}
        </p>
      )}
      <Table
        caption={t("analytics.mcp.caption")}
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.authorizationId}
        isLoading={isLoading}
        emptyState={<EmptyState title={t("analytics.mcp.emptyTitle")} description={t("analytics.mcp.emptyDescription")} />}
      />
    </section>
  );
}
