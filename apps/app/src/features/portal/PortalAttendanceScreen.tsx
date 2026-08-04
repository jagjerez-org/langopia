import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Skeleton, Table, Chip } from "@langopia/ui";
import type { TableColumn, ChipVariant } from "@langopia/ui";
import { useT, useLocale } from "../../i18n/translate.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { ApiError } from "../../lib/api-client.js";
import { getMyAttendance } from "./api.js";
import { useMyStudentsQuery, useSchoolTimezoneQuery } from "./hooks.js";
import { StudentSwitcher, usePortalStudentId } from "./StudentSwitcher.js";
import type { PortalAttendanceEntry } from "./types.js";

const STATUS_VARIANT: Record<string, ChipVariant> = {
  present: "success",
  late: "warning",
  absent: "critical",
  excused: "neutral",
};

/** `/mi/asistencia` (Paso 1 del brief, verbatim): "mi asistencia" del alumno o de su tutor. */
export function PortalAttendanceScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { studentId, setStudentId } = usePortalStudentId();
  const studentsQuery = useMyStudentsQuery();
  const timezoneQuery = useSchoolTimezoneQuery();
  const attendanceQuery = useQuery({
    queryKey: ["portal", "attendance", studentId ?? "own"] as const,
    queryFn: () => getMyAttendance(studentId),
  });

  const isPending = studentsQuery.isPending || timezoneQuery.isPending || attendanceQuery.isPending;
  const firstError = attendanceQuery.error ?? timezoneQuery.error ?? studentsQuery.error;

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
          title={problem ? errorMessage(problem) : t("portal.attendance.errorTitle")}
          action={
            <Button
              onClick={() => {
                void studentsQuery.refetch();
                void timezoneQuery.refetch();
                void attendanceQuery.refetch();
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
  const entries = attendanceQuery.data ?? [];

  const columns: TableColumn<PortalAttendanceEntry>[] = [
    {
      key: "start",
      header: t("portal.attendance.columnDate"),
      numeric: true,
      render: (row) => formatDate(row.start, timeZone, locale, { dateStyle: "medium", timeStyle: "short" }),
    },
    { key: "group", header: t("portal.attendance.columnGroup"), render: (row) => row.groupName },
    {
      key: "status",
      header: t("portal.attendance.columnStatus"),
      render: (row) => (
        <Chip variant={STATUS_VARIANT[row.status] ?? "neutral"}>
          {t.has(`portal.attendance.status.${row.status}`) ? t(`portal.attendance.status.${row.status}`) : row.status}
        </Chip>
      ),
    },
  ];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("portal.attendance.title")}</h1>
      <StudentSwitcher students={students} value={studentId} onChange={setStudentId} />
      <Table
        columns={columns}
        rows={entries}
        getRowKey={(row) => row.sessionId}
        caption={t("portal.attendance.title")}
        captionVisuallyHidden
        emptyState={<EmptyState title={t("portal.attendance.emptyTitle")} />}
      />
    </main>
  );
}
