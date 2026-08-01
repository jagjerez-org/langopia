import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AgendaEntry } from "@langopia/contracts";
import { Button, Dialog, EmptyState, ErrorState, Skeleton } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { useT } from "../../i18n/translate.js";
import { ApiError } from "../../lib/api-client.js";
import { getGroupRoster, recordAttendance } from "./api.js";

export interface AttendanceDialogProps {
  open: boolean;
  session: AgendaEntry;
  onClose: () => void;
  onRecorded: () => void;
}

/**
 * Pasar lista (Paso 6 del brief), desde la propia clase. El padrón llega de
 * `GET /scheduling/groups/:groupId/roster` (añadido por esta tarea): antes no
 * había forma de que el panel supiera los NOMBRES del alumnado matriculado,
 * solo la API interna (`GroupEnrollmentPort`) conocía los identificadores.
 *
 * Cada alumno empieza marcado como presente — cambiar de opinión es
 * desmarcar, no al revés —, y `entries` solo manda a quien de verdad se
 * marcó (presente o ausente): la API decide qué hacer con quien no aparece.
 */
export function AttendanceDialog({
  open,
  session,
  onClose,
  onRecorded,
}: AttendanceDialogProps): ReactElement {
  const t = useT();
  const describeError = useErrorMessage();
  const [presentByStudent, setPresentByStudent] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const roster = useQuery({
    queryKey: ["calendar", "roster", session.groupId],
    queryFn: () => getGroupRoster(session.groupId),
    enabled: open,
  });

  useEffect(() => {
    if (!roster.data) return;
    setPresentByStudent(Object.fromEntries(roster.data.map((student) => [student.studentId, true])));
  }, [roster.data]);

  async function handleSubmit(): Promise<void> {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const entries = Object.entries(presentByStudent).map(([studentId, present]) => ({
        studentId,
        status: present ? ("present" as const) : ("absent" as const),
      }));
      await recordAttendance(session.sessionId, entries);
      onRecorded();
    } catch (error) {
      setFormError(error instanceof ApiError ? describeError(error.problem) : t("common.unexpectedError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.attendanceDialogTitle")}
      description={session.groupName}
      closeLabel={t("calendar.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("calendar.close")}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            isLoading={isSubmitting}
            disabled={!roster.isSuccess || roster.data.length === 0}
          >
            {isSubmitting ? t("calendar.confirmAttendanceSubmitting") : t("calendar.confirmAttendance")}
          </Button>
        </>
      }
    >
      {roster.isPending && <Skeleton variant="text" lines={4} />}
      {roster.isError && (
        <ErrorState
          title={
            roster.error instanceof ApiError
              ? describeError(roster.error.problem)
              : t("common.unexpectedError")
          }
          action={
            <Button variant="secondary" onClick={() => void roster.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      )}
      {roster.isSuccess && roster.data.length === 0 && (
        <EmptyState title={t("calendar.attendanceEmptyRoster")} />
      )}
      {roster.isSuccess && roster.data.length > 0 && (
        <fieldset>
          <legend>{t("calendar.attendanceInstructions")}</legend>
          {roster.data.map((student) => (
            <label key={student.studentId} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={presentByStudent[student.studentId] ?? true}
                onChange={(event) =>
                  setPresentByStudent((current) => ({
                    ...current,
                    [student.studentId]: event.target.checked,
                  }))
                }
              />
              {student.name}
            </label>
          ))}
        </fieldset>
      )}
      {formError && <p role="alert">{formError}</p>}
    </Dialog>
  );
}
