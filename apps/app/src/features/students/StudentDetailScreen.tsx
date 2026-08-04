import { useState } from "react";
import type { ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Button, Panel, Dialog, EmptyState, ErrorState, Input, Selector, Skeleton, Table, Chip, useToast } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useT, useLocale } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatMoney } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import {
  evaluateStudent,
  exportPersonalData,
  getStudentsWithoutEvaluation,
  leaveStudent,
  listStudents,
  updateStudent,
} from "./api.js";
import { formatStudentDate } from "./format.js";
import { ProgressPanel } from "./progress/ProgressPanel.js";
import { STUDENTS_QUERY_KEY } from "./StudentsListScreen.js";
import { Tabs } from "./Tabs.js";
import type {
  AttendanceEntry,
  CefrLevel,
  ConsentEntry,
  ConsentKind,
  EvaluationEntry,
  InvoiceEntry,
  PersonalDataExport,
  StudentListItem,
} from "./types.js";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CONSENT_KINDS: ConsentKind[] = [
  "data_processing",
  "recording",
  "transcription",
  "ai_processing",
  "marketing",
  "image_rights",
];
const OVERDUE_WEEKS = 3;

const ATTENDANCE_VARIANT: Record<string, ChipVariant> = {
  present: "success",
  late: "warning",
  absent: "critical",
  excused: "neutral",
};

const INVOICE_VARIANT: Record<string, ChipVariant> = {
  paid: "success",
  open: "warning",
  past_due: "critical",
  draft: "neutral",
  void: "neutral",
  uncollectible: "critical",
};

/**
 * Ficha del alumno (Tarea 7, Paso 5), con sus cinco pestañas.
 *
 * `GET /students` no tiene ruta de detalle propia, así que "datos" viene de
 * la misma lista que pinta `StudentsListScreen` (cacheada por TanStack Query
 * con la misma clave: no hay una segunda llamada si ya se navegó desde ahí).
 * Las otras cuatro pestañas —asistencia, consentimientos, facturas,
 * valoraciones— vienen de `GET /people/:membershipId/export` (Tarea 15,
 * RGPD): el mismo modelo de lectura que ya reúne exactamente esos datos por
 * persona, sin duplicar nada nuevo en el servidor.
 */
export function StudentDetailScreen(): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { studentId } = useParams({ strict: false }) as { studentId?: string };

  const listQuery = useQuery({ queryKey: STUDENTS_QUERY_KEY, queryFn: listStudents });
  const student = listQuery.data?.find((s) => s.studentId === studentId);

  if (listQuery.isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (listQuery.isError) {
    const problem = listQuery.error instanceof ApiError ? listQuery.error.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("students.list.errorTitle")}
          action={<Button onClick={() => void listQuery.refetch()}>{t("common.retry")}</Button>}
        />
      </main>
    );
  }

  if (!student) {
    return (
      <main className="p-6">
        <ErrorState title={t("students.detail.notFoundTitle")} />
      </main>
    );
  }

  return <StudentDetailContent student={student} />;
}

function StudentDetailContent({ student }: { student: StudentListItem }): ReactElement {
  const t = useT();
  const locale = useLocale();

  const exportQuery = useQuery({
    queryKey: ["students", "export", student.membershipId] as const,
    queryFn: () => exportPersonalData(student.membershipId),
  });

  const overdueQuery = useQuery({
    queryKey: ["assessments", "without-evaluation", OVERDUE_WEEKS] as const,
    queryFn: () => getStudentsWithoutEvaluation(OVERDUE_WEEKS),
  });
  const overdue = overdueQuery.data?.find((s) => s.studentId === student.studentId) ?? null;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{student.name}</h1>
      <p className="text-secondary mb-4">{student.email}</p>

      <Tabs
        label={t("students.title")}
        tabs={[
          {
            id: "data",
            label: t("students.detail.tabData"),
            content: <DataTab student={student} exportData={exportQuery.data ?? null} />,
          },
          {
            id: "attendance",
            label: t("students.detail.tabAttendance"),
            content: (
              <AttendanceTab
                isLoading={exportQuery.isPending}
                isError={exportQuery.isError}
                entries={exportQuery.data?.attendance ?? []}
                locale={locale}
              />
            ),
          },
          {
            id: "consents",
            label: t("students.detail.tabConsents"),
            content: (
              <ConsentsTab
                isLoading={exportQuery.isPending}
                isError={exportQuery.isError}
                entries={exportQuery.data?.consents ?? []}
                locale={locale}
              />
            ),
          },
          {
            id: "invoices",
            label: t("students.detail.tabInvoices"),
            content: (
              <InvoicesTab
                isLoading={exportQuery.isPending}
                isError={exportQuery.isError}
                entries={exportQuery.data?.invoices ?? []}
                locale={locale}
              />
            ),
          },
          {
            id: "evaluations",
            label: t("students.detail.tabEvaluations"),
            content: (
              <EvaluationsTab
                studentId={student.studentId}
                isLoading={exportQuery.isPending}
                isError={exportQuery.isError}
                entries={exportQuery.data?.evaluations.filter((e) => e.as === "student") ?? []}
                overdueWeeks={overdue?.weeksSinceLastEvaluation ?? null}
                everEvaluated={overdue === null || overdue.weeksSinceLastEvaluation !== null}
                locale={locale}
              />
            ),
          },
          {
            id: "progress",
            label: t("students.detail.tabProgress"),
            content: <ProgressPanel studentId={student.studentId} />,
          },
        ]}
      />
    </main>
  );
}

/* ─── Pestaña «Datos» ───────────────────────────────────────────────────── */

type EditFormValues = { dateOfBirth: string; currentLevel: string };
type LeaveFormValues = { reason: string };

function DataTab({
  student,
  exportData,
}: {
  student: StudentListItem;
  exportData: PersonalDataExport | null;
}): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editError, setEditError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const editForm = useForm<EditFormValues>({
    defaultValues: { dateOfBirth: student.dateOfBirth, currentLevel: student.currentLevel ?? "" },
  });
  const leaveForm = useForm<LeaveFormValues>({ defaultValues: { reason: "" } });

  const editMutation = useMutation({
    mutationFn: (values: EditFormValues) =>
      updateStudent(student.studentId, {
        dateOfBirth: values.dateOfBirth,
        currentLevel: values.currentLevel === "" ? null : (values.currentLevel as CefrLevel),
      }),
    onSuccess: async () => {
      showToast({ variant: "success", title: t("students.detail.editSuccess") });
      await queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    },
    onError: (error) => {
      setEditError(error instanceof ApiError ? errorMessage(error.problem) : t("students.detail.editError"));
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (values: LeaveFormValues) => leaveStudent(student.studentId, values.reason),
    onSuccess: async () => {
      showToast({ variant: "success", title: t("students.detail.leaveSuccess") });
      setLeaveOpen(false);
      await queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    },
    onError: (error) => {
      setLeaveError(error instanceof ApiError ? errorMessage(error.problem) : t("students.detail.leaveError"));
    },
  });

  const onSubmitEdit = editForm.handleSubmit((values) => {
    setEditError(null);
    editMutation.mutate(values);
  });
  const onSubmitLeave = leaveForm.handleSubmit((values) => {
    setLeaveError(null);
    leaveMutation.mutate(values);
  });

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("students.detail.editTitle")}>
        <dl className="grid grid-cols-2 gap-2 mb-4">
          <dt className="text-secondary">{t("students.detail.nameLabel")}</dt>
          <dd>{student.name}</dd>
          <dt className="text-secondary">{t("students.detail.emailLabel")}</dt>
          <dd>{student.email}</dd>
          <dt className="text-secondary">{t("students.detail.joinedAtLabel")}</dt>
          <dd>{formatStudentDate(student.joinedAt, locale, { dateStyle: "medium" })}</dd>
          <dt className="text-secondary">{t("students.detail.nativeLanguageLabel")}</dt>
          <dd>{student.nativeLanguage}</dd>
          <dt className="text-secondary">{t("students.detail.targetLanguageLabel")}</dt>
          <dd>{student.targetLanguage}</dd>
          <dt className="text-secondary">{t("students.detail.statusLabel")}</dt>
          <dd>{t(`students.status.${student.status}`)}</dd>
          {exportData?.student?.goals && (
            <>
              <dt className="text-secondary">{t("students.detail.goalsLabel")}</dt>
              <dd>{exportData.student.goals}</dd>
            </>
          )}
          {exportData?.student?.targetLevel && (
            <>
              <dt className="text-secondary">{t("students.detail.targetLevelLabel")}</dt>
              <dd>{exportData.student.targetLevel}</dd>
            </>
          )}
          {student.status === "paused" && exportData?.student?.pausedUntil && (
            <>
              <dt className="text-secondary">{t("students.detail.pausedUntilLabel")}</dt>
              <dd>{exportData.student.pausedUntil}</dd>
            </>
          )}
          {student.status === "left" && exportData?.student?.leftReason && (
            <>
              <dt className="text-secondary">{t("students.detail.leftReasonLabel")}</dt>
              <dd>{exportData.student.leftReason}</dd>
            </>
          )}
        </dl>
        <p role="status" className="text-sm text-secondary mb-4">
          {t("students.detail.emailNotEditableHint")}
        </p>

        <form onSubmit={(event) => void onSubmitEdit(event)} noValidate className="flex flex-col gap-4 max-w-sm">
          <Input
            label={t("students.create.dateOfBirthLabel")}
            type="date"
            {...editForm.register("dateOfBirth")}
          />
          <Selector
            label={t("students.create.levelLabel")}
            options={LEVELS.map((level) => ({ value: level, label: level }))}
            placeholder={t("students.levelNone")}
            {...editForm.register("currentLevel")}
          />
          {editError && <p role="alert">{editError}</p>}
          <Button type="submit" isLoading={editMutation.isPending}>
            {editMutation.isPending ? t("students.detail.editSubmitting") : t("students.detail.editSubmit")}
          </Button>
        </form>
      </Panel>

      <Panel title={t("students.detail.guardiansTitle")}>
        {exportData && exportData.student && exportData.student.guardians.length > 0 ? (
          <ul>
            {exportData.student.guardians.map((guardian) => (
              <li key={guardian.membershipId}>
                {guardian.name} — {t(`students.guardianRelationship.${guardian.relationship}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("students.detail.noGuardians")}</p>
        )}
      </Panel>

      {student.status !== "left" && (
        <div>
          <Button variant="danger" onClick={() => setLeaveOpen(true)}>
            {t("students.detail.leaveAction")}
          </Button>
          <Dialog
            open={leaveOpen}
            onClose={() => setLeaveOpen(false)}
            title={t("students.detail.leaveDialogTitle", { name: student.name })}
            description={t("students.detail.leaveDialogDescription")}
            closeLabel={t("students.detail.closeDialog")}
            footer={
              <>
                <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
                  {t("students.detail.leaveCancel")}
                </Button>
                <Button variant="danger" isLoading={leaveMutation.isPending} onClick={() => void onSubmitLeave()}>
                  {t("students.detail.leaveConfirm")}
                </Button>
              </>
            }
          >
            <Input
              label={t("students.detail.leaveReasonLabel")}
              required
              error={leaveForm.formState.errors.reason?.message}
              {...leaveForm.register("reason", { required: t("students.detail.leaveReasonRequired") })}
            />
            {leaveError && <p role="alert">{leaveError}</p>}
          </Dialog>
        </div>
      )}
    </div>
  );
}

/* ─── Pestaña «Asistencia» ──────────────────────────────────────────────── */

function AttendanceTab({
  isLoading,
  isError,
  entries,
  locale,
}: {
  isLoading: boolean;
  isError: boolean;
  entries: AttendanceEntry[];
  locale: ReturnType<typeof useLocale>;
}): ReactElement {
  const t = useT();
  const columns: TableColumn<AttendanceEntry>[] = [
    {
      key: "date",
      header: t("students.attendance.columnDate"),
      numeric: true,
      render: (row) => formatStudentDate(row.scheduledStart, locale, { dateStyle: "medium", timeStyle: "short" }),
    },
    { key: "group", header: t("students.attendance.columnGroup"), render: (row) => row.groupName },
    {
      key: "status",
      header: t("students.attendance.columnStatus"),
      render: (row) => (
        <Chip variant={ATTENDANCE_VARIANT[row.status] ?? "neutral"}>
          {t.has(`students.attendance.status.${row.status}`) ? t(`students.attendance.status.${row.status}`) : row.status}
        </Chip>
      ),
    },
    {
      key: "minutes",
      header: t("students.attendance.columnMinutes"),
      numeric: true,
      render: (row) => (row.minutesPresent ?? "—").toString(),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={entries}
      getRowKey={(row) => row.sessionId}
      caption={t("students.attendance.caption")}
      captionVisuallyHidden
      isLoading={isLoading}
      error={isError ? <ErrorState title={t("students.attendance.errorTitle")} /> : undefined}
      emptyState={<EmptyState title={t("students.attendance.emptyTitle")} />}
    />
  );
}

/* ─── Pestaña «Consentimientos» (solo lectura) ─────────────────────────── */

function ConsentsTab({
  isLoading,
  isError,
  entries,
  locale,
}: {
  isLoading: boolean;
  isError: boolean;
  entries: ConsentEntry[];
  locale: ReturnType<typeof useLocale>;
}): ReactElement {
  const t = useT();

  if (isLoading) return <Skeleton variant="text" lines={3} />;
  if (isError) return <ErrorState title={t("students.consents.errorTitle")} />;

  const byKind = new Map(entries.map((entry) => [entry.kind, entry]));

  return (
    <table className="w-full">
      <caption className="sr-only">{t("students.consents.caption")}</caption>
      <thead>
        <tr>
          <th className="text-left">{t("students.consents.columnKind")}</th>
          <th className="text-left">{t("students.consents.columnStatus")}</th>
          <th className="text-left">{t("students.consents.columnDetail")}</th>
        </tr>
      </thead>
      <tbody>
        {CONSENT_KINDS.map((kind) => {
          const entry = byKind.get(kind);
          const granted = entry?.status === "granted";
          const withdrawn = entry?.status === "withdrawn";
          return (
            <tr key={kind}>
              <td>{t(`students.consents.kind.${kind}`)}</td>
              <td>
                <Chip variant={granted ? "success" : withdrawn ? "critical" : "neutral"}>
                  {granted
                    ? t("students.consents.granted")
                    : withdrawn
                      ? t("students.consents.withdrawn")
                      : t("students.consents.notRecorded")}
                </Chip>
              </td>
              <td>
                {granted && entry?.grantedAt
                  ? t("students.consents.grantedOn", { date: formatStudentDate(entry.grantedAt, locale, { dateStyle: "medium" }) })
                  : withdrawn && entry?.withdrawnAt
                    ? t("students.consents.withdrawnOn", { date: formatStudentDate(entry.withdrawnAt, locale, { dateStyle: "medium" }) })
                    : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Pestaña «Facturas» ────────────────────────────────────────────────── */

function InvoicesTab({
  isLoading,
  isError,
  entries,
  locale,
}: {
  isLoading: boolean;
  isError: boolean;
  entries: InvoiceEntry[];
  locale: ReturnType<typeof useLocale>;
}): ReactElement {
  const t = useT();
  const columns: TableColumn<InvoiceEntry>[] = [
    { key: "number", header: t("students.invoices.columnNumber"), render: (row) => row.number },
    {
      key: "direction",
      header: t("students.invoices.columnDirection"),
      render: (row) =>
        t.has(`students.invoices.direction.${row.direction}`) ? t(`students.invoices.direction.${row.direction}`) : row.direction,
    },
    {
      key: "status",
      header: t("students.invoices.columnStatus"),
      render: (row) => (
        <Chip variant={INVOICE_VARIANT[row.status] ?? "neutral"}>
          {t.has(`students.invoices.status.${row.status}`) ? t(`students.invoices.status.${row.status}`) : row.status}
        </Chip>
      ),
    },
    {
      key: "total",
      header: t("students.invoices.columnTotal"),
      numeric: true,
      render: (row) => formatMoney(row.totalCents, row.currency, locale),
    },
    {
      key: "issuedOn",
      header: t("students.invoices.columnIssuedOn"),
      numeric: true,
      render: (row) => (row.issuedOn ? formatStudentDate(row.issuedOn, locale, { dateStyle: "medium" }) : "—"),
    },
    {
      key: "dueOn",
      header: t("students.invoices.columnDueOn"),
      numeric: true,
      render: (row) => (row.dueOn ? formatStudentDate(row.dueOn, locale, { dateStyle: "medium" }) : "—"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={entries}
      getRowKey={(row) => row.invoiceId}
      caption={t("students.invoices.caption")}
      captionVisuallyHidden
      isLoading={isLoading}
      error={isError ? <ErrorState title={t("students.invoices.errorTitle")} /> : undefined}
      emptyState={<EmptyState title={t("students.invoices.emptyTitle")} />}
    />
  );
}

/* ─── Pestaña «Valoraciones» ────────────────────────────────────────────── */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EvaluationFormValues = {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  progressRating: string;
  levelAtEvaluation: string;
  strengths: string;
  improvements: string;
  nextSteps: string;
};

function EvaluationsTab({
  studentId,
  isLoading,
  isError,
  entries,
  overdueWeeks,
  everEvaluated,
  locale,
}: {
  studentId: string;
  isLoading: boolean;
  isError: boolean;
  entries: EvaluationEntry[];
  overdueWeeks: number | null;
  everEvaluated: boolean;
  locale: ReturnType<typeof useLocale>;
}): ReactElement {
  const t = useT();
  const errorMessage = useErrorMessage();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EvaluationFormValues>({
    defaultValues: {
      teacherId: "",
      periodStart: "",
      periodEnd: "",
      progressRating: "3",
      levelAtEvaluation: "",
      strengths: "",
      improvements: "",
      nextSteps: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await evaluateStudent({
        teacherId: values.teacherId,
        studentId,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        progressRating: Number(values.progressRating),
        levelAtEvaluation: values.levelAtEvaluation === "" ? null : (values.levelAtEvaluation as CefrLevel),
        strengths: values.strengths === "" ? null : values.strengths,
        improvements: values.improvements === "" ? null : values.improvements,
        nextSteps: values.nextSteps === "" ? null : values.nextSteps,
      });
      showToast({ variant: "success", title: t("students.evaluations.success") });
      reset();
      await queryClient.invalidateQueries({ queryKey: ["students", "export", studentId] });
      await queryClient.invalidateQueries({ queryKey: ["assessments", "without-evaluation"] });
    } catch (error) {
      setFormError(error instanceof ApiError ? errorMessage(error.problem) : t("students.evaluations.genericError"));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {(overdueWeeks !== null || !everEvaluated) && (
        <Chip variant="warning">
          {everEvaluated && overdueWeeks !== null
            ? t("students.evaluations.overdueWeeks", { weeks: overdueWeeks })
            : t("students.evaluations.overdueNever")}
        </Chip>
      )}

      {isLoading ? (
        <Skeleton variant="text" lines={3} />
      ) : isError ? (
        <ErrorState title={t("students.evaluations.errorTitle")} />
      ) : entries.length === 0 ? (
        <EmptyState title={t("students.evaluations.emptyTitle")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.evaluationId} className="border border-border rounded-md p-4">
              <p className="font-medium">
                {t("students.evaluations.periodDisplay", {
                  start: formatStudentDate(`${entry.periodStart}T00:00:00Z`, locale, { dateStyle: "medium" }),
                  end: formatStudentDate(`${entry.periodEnd}T00:00:00Z`, locale, { dateStyle: "medium" }),
                })}
              </p>
              <p>
                {t("students.evaluations.ratingLabel")}: {t("students.evaluations.ratingValue", { rating: entry.progressRating })}
              </p>
              {entry.strengths && (
                <p>
                  {t("students.evaluations.strengthsLabel")}: {entry.strengths}
                </p>
              )}
              {entry.improvements && (
                <p>
                  {t("students.evaluations.improvementsLabel")}: {entry.improvements}
                </p>
              )}
              {entry.nextSteps && (
                <p>
                  {t("students.evaluations.nextStepsLabel")}: {entry.nextSteps}
                </p>
              )}
              <p className="text-secondary text-sm">{t("students.evaluations.byTeacher", { name: entry.counterpartName })}</p>
            </li>
          ))}
        </ul>
      )}

      <Panel title={t("students.evaluations.formTitle")}>
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4 max-w-md">
          <Input
            label={t("students.evaluations.teacherIdLabel")}
            hint={t("students.evaluations.teacherIdHint")}
            required
            error={errors.teacherId?.message}
            {...register("teacherId", {
              required: t("students.evaluations.teacherIdRequired"),
              pattern: { value: UUID_PATTERN, message: t("students.evaluations.teacherIdInvalid") },
            })}
          />
          <Input
            label={t("students.evaluations.periodStartLabel")}
            type="date"
            required
            error={errors.periodStart?.message}
            {...register("periodStart", { required: t("students.evaluations.periodStartRequired") })}
          />
          <Input
            label={t("students.evaluations.periodEndLabel")}
            type="date"
            required
            error={errors.periodEnd?.message}
            {...register("periodEnd", { required: t("students.evaluations.periodEndRequired") })}
          />
          <Selector
            label={t("students.evaluations.ratingLabel")}
            options={["1", "2", "3", "4", "5"].map((value) => ({ value, label: value }))}
            {...register("progressRating")}
          />
          <Selector
            label={t("students.evaluations.levelAtEvaluationLabel")}
            options={LEVELS.map((level) => ({ value: level, label: level }))}
            placeholder={t("students.levelNone")}
            {...register("levelAtEvaluation")}
          />
          <Input
            label={t("students.evaluations.strengthsLabel")}
            error={errors.strengths?.message}
            {...register("strengths", {
              validate: (value) => value === "" || value.length >= 3 || t("students.evaluations.minLengthError"),
            })}
          />
          <Input
            label={t("students.evaluations.improvementsLabel")}
            error={errors.improvements?.message}
            {...register("improvements", {
              validate: (value) => value === "" || value.length >= 3 || t("students.evaluations.minLengthError"),
            })}
          />
          <Input
            label={t("students.evaluations.nextStepsLabel")}
            error={errors.nextSteps?.message}
            {...register("nextSteps", {
              validate: (value) => value === "" || value.length >= 3 || t("students.evaluations.minLengthError"),
            })}
          />
          {formError && <p role="alert">{formError}</p>}
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? t("students.evaluations.submitting") : t("students.evaluations.submit")}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
