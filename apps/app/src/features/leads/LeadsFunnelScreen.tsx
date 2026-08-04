import { useMemo } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel, EmptyState, ErrorState, Skeleton, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { listLeads } from "./api.js";
import type { LeadFunnelView, LeadStatus } from "./api.js";

const STATUS_VARIANT: Record<LeadStatus, ChipVariant> = {
  new: "neutral",
  placement_sent: "warning",
  placement_done: "success",
  contacted: "warning",
  converted: "success",
  cold: "neutral",
  discarded: "critical",
};

export function LeadsFunnelScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ["leads", "funnel"], queryFn: listLeads });
  const rows = query.data ?? [];
  const metrics = useMemo(() => funnelMetrics(rows), [rows]);
  const columns = useMemo<TableColumn<LeadFunnelView>[]>(
    () => [
      {
        key: "candidate",
        header: t("leads.columnCandidate"),
        render: (row) => (
          <div className="flex flex-col">
            <span>{row.name}</span>
            <span className="text-sm text-slate-600">{row.email}</span>
          </div>
        ),
      },
      {
        key: "status",
        header: t("leads.columnStatus"),
        render: (row) => <Chip variant={STATUS_VARIANT[row.status]}>{t(`leads.status.${row.status}`)}</Chip>,
      },
      {
        key: "level",
        header: t("leads.columnLevel"),
        render: (row) => levelText(row),
      },
      {
        key: "source",
        header: t("leads.columnSource"),
        render: (row) => sourceText(row),
      },
      {
        key: "createdAt",
        header: t("leads.columnCreated"),
        render: (row) => new Date(row.createdAt).toLocaleDateString(),
      },
    ],
    [t],
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("leads.title")}</h1>

      <section className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Panel title={t("leads.metricTotal")}>
          {query.isPending ? <Skeleton variant="text" lines={1} /> : <p className="text-2xl font-semibold">{t("leads.count", { count: metrics.total })}</p>}
        </Panel>
        <Panel title={t("leads.metricPlacementDone")}>
          {query.isPending ? <Skeleton variant="text" lines={1} /> : <p className="text-2xl font-semibold">{t("leads.placementDoneCount", { count: metrics.placementDone })}</p>}
        </Panel>
        <Panel title={t("leads.metricCold")}>
          {query.isPending ? <Skeleton variant="text" lines={1} /> : <p className="text-2xl font-semibold">{t("leads.coldCount", { count: metrics.cold })}</p>}
        </Panel>
      </section>

      {query.isPending && (
        <>
          <p role="status">{t("common.loading")}</p>
          <Skeleton variant="text" lines={5} />
        </>
      )}

      {query.error && (
        <ErrorState
          title={query.error instanceof ApiError ? errorMessage(query.error.problem) : t("leads.errorTitle")}
        />
      )}

      {!query.isPending && !query.error && (
        <Table
          caption={t("leads.caption")}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyState={<EmptyState title={t("leads.emptyTitle")} description={t("leads.emptyDescription")} />}
        />
      )}
    </main>
  );
}

function funnelMetrics(rows: readonly LeadFunnelView[]): {
  total: number;
  placementDone: number;
  cold: number;
} {
  return {
    total: rows.length,
    placementDone: rows.filter((row) => row.status === "placement_done" || row.status === "converted").length,
    cold: rows.filter((row) => row.status === "cold").length,
  };
}

function levelText(row: LeadFunnelView): string {
  if (row.declaredLevel && row.placementLevel) return `${row.declaredLevel} → ${row.placementLevel}`;
  return row.placementLevel ?? row.declaredLevel ?? "—";
}

function sourceText(row: LeadFunnelView): string {
  const parts = [row.sourcePage, row.sourceCampaign].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
