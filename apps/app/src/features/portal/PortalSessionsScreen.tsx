import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, EmptyState, ErrorState, Skeleton, Table, Tag } from "../../ui/index.js";
import type { TableColumn, TagVariant } from "../../ui/index.js";
import { useT, useLocale } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { getMySessions } from "./api.js";
import { useMyStudentsQuery, useSchoolTimezoneQuery } from "./hooks.js";
import { StudentSwitcher, usePortalStudentId } from "./StudentSwitcher.js";
import type { PortalSessionEntry } from "./types.js";

const STATUS_VARIANT: Record<string, TagVariant> = {
  scheduled: "neutral",
  in_progress: "success",
  completed: "neutral",
  canceled_by_school: "critical",
  canceled_by_student: "critical",
  rescheduled: "warning",
  no_show: "critical",
};

/**
 * `/mi/clases` (Paso 1 del brief, verbatim): "mis clases" del alumno o de su
 * tutor. `GET /portal/me/sessions` ya resuelve DE QUIÉN son "mis" —el propio
 * interesado, o el hijo elegido con `StudentSwitcher` (Paso 2)—, así que esta
 * pantalla no decide nada, solo pinta lo que llega.
 *
 * "Entrar al aula" se ofrece siempre, sin mirar el estado de la clase ni el
 * proveedor: igual que `SessionMenuDialog` del calendario, el panel no decide
 * qué está permitido — lo decide la API (`room_not_ready`,
 * `not_enrolled_in_session`...) cuando `/aula/:sessionId` lo intenta de
 * verdad.
 */
export function PortalSessionsScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();
  const timezoneQuery = useSchoolTimezoneQuery();
  const sessionsQuery = useQuery({
    queryKey: ["portal", "sessions", studentId ?? "own"] as const,
    queryFn: () => getMySessions(studentId),
  });

  const isPending = studentsQuery.isPending || timezoneQuery.isPending || sessionsQuery.isPending;
  const firstError = sessionsQuery.error ?? timezoneQuery.error ?? studentsQuery.error;

  if (isPending) {
    return (
      <main className="p-6">
        <Skeleton variant="text" lines={4} />
      </main>
    );
  }

  if (firstError) {
    const problem = firstError instanceof ApiError ? firstError.problem : null;
    return (
      <main className="p-6">
        <ErrorState
          title={problem ? errorMessage(problem) : t("portal.sessions.errorTitle")}
          action={
            <Button
              onClick={() => {
                void studentsQuery.refetch();
                void timezoneQuery.refetch();
                void sessionsQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      </main>
    );
  }

  const students = studentsQuery.data ?? [];
  const timeZone = timezoneQuery.data!.timezone;
  const sessions = sessionsQuery.data ?? [];

  const columns: TableColumn<PortalSessionEntry>[] = [
    {
      key: "group",
      header: t("portal.sessions.columnGroup"),
      render: (row) => `${row.groupName} (${row.courseCode})`,
    },
    {
      key: "teacher",
      header: t("portal.sessions.columnTeacher"),
      render: (row) => row.teacherName ?? t("portal.sessions.teacherUnassigned"),
    },
    {
      key: "start",
      header: t("portal.sessions.columnStart"),
      numeric: true,
      render: (row) => formatDate(row.start, timeZone, locale, { dateStyle: "medium", timeStyle: "short" }),
    },
    {
      key: "status",
      header: t("portal.sessions.columnStatus"),
      render: (row) => (
        <Tag variant={STATUS_VARIANT[row.status] ?? "neutral"}>
          {t.has(`portal.sessions.status.${row.status}`) ? t(`portal.sessions.status.${row.status}`) : row.status}
        </Tag>
      ),
    },
    {
      key: "room",
      header: t("portal.sessions.columnRoom"),
      render: (row) =>
        t.has(`portal.roomProvider.${row.roomProvider}`)
          ? t(`portal.roomProvider.${row.roomProvider}`)
          : row.roomProvider,
    },
    {
      key: "join",
      header: t("portal.sessions.columnAction"),
      render: (row) => (
        <Link to="/aula/$sessionId" params={{ sessionId: row.sessionId }}>
          {t("portal.sessions.joinAction")}
        </Link>
      ),
    },
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("portal.sessions.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />
      <Table
        columns={columns}
        rows={sessions}
        getRowKey={(row) => row.sessionId}
        caption={t("portal.sessions.title")}
        captionVisuallyHidden
        emptyState={<EmptyState title={t("portal.sessions.emptyTitle")} />}
      />
    </main>
  );
}
