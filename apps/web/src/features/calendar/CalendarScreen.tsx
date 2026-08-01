import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgendaEntry } from "@langopia/contracts";
import { Button, EmptyState, ErrorState, Skeleton } from "../../ui/index.js";
import { useErrorMessage } from "../../i18n/errors.js";
import { formatDate } from "../../i18n/format.js";
import { useLocale, useT } from "../../i18n/translate.js";
import { ApiError, getSchoolSlug } from "../../lib/api-client.js";
import { useSession } from "../auth/session.js";
import { listCourses } from "../courses/api.js";
import { listTeachers } from "../teachers/api.js";
import { getAgenda, getSchoolTimezone } from "./api.js";
import { AttendanceDialog } from "./AttendanceDialog.js";
import { CancelSessionDialog } from "./CancelSessionDialog.js";
import { RescheduleDialog } from "./RescheduleDialog.js";
import { ScheduleSessionDialog } from "./ScheduleSessionDialog.js";
import type { GroupOption, TeacherOption } from "./ScheduleSessionDialog.js";
import { SessionMenuDialog } from "./SessionMenuDialog.js";
import { WeekGrid } from "./WeekGrid.js";
import { addWeeks, weekRangeContaining } from "./week-range.js";

type DialogState =
  | { type: "closed" }
  | { type: "new-session" }
  | { type: "menu"; session: AgendaEntry }
  | { type: "cancel"; session: AgendaEntry }
  | { type: "reschedule"; session: AgendaEntry; prefillStartsAtIso?: string }
  | { type: "attendance"; session: AgendaEntry };

/**
 * Calendario (Tarea 9): la pantalla más interactiva del panel.
 *
 * Todas las fechas que pinta van en la zona horaria de LA ESCUELA
 * (`GET /scheduling/school-timezone`, añadido por esta tarea), nunca la del
 * navegador — quien dirige una academia española desde Argentina ve sus
 * clases a la hora de Madrid, no a la suya.
 *
 * Selectores de grupo y profesor: `GET /courses` (con sus grupos anidados) y
 * `GET /teachers` (Tarea 13 del panel, hallazgo del recorrido de Playwright).
 * Hasta ese arreglo, las opciones de los diálogos de alta y replanificación
 * salían de una consulta ancha a la agenda (±1 año) —la única fuente que
 * existía cuando esta tarea (9) se escribió a la vez que las tareas 7/8,
 * antes de que hubiera un listado dedicado—: un grupo o un profesor recién
 * creados, sin ninguna clase todavía, nunca aparecían en el desplegable, así
 * que no había forma de programar la PRIMERA clase de un grupo nuevo desde
 * el panel. `listCourses`/`listTeachers` ya existían (Tarea 8) y no dependen
 * de que exista ninguna clase previa.
 */
export function CalendarScreen(): ReactElement {
  const t = useT();
  const locale = useLocale();
  const describeError = useErrorMessage();
  const queryClient = useQueryClient();
  const session = useSession();

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [banner, setBanner] = useState<{ variant: "success" | "critical"; text: string } | null>(null);

  /**
   * Distingue el caché de una escuela del de otra dentro del mismo
   * `QueryClient` (montado una sola vez en `main.tsx`, ver Tarea 3). Sin esto,
   * cerrar sesión y entrar como una persona de OTRA escuela reutilizaba en
   * silencio la zona horaria y la agenda cacheadas de la escuela anterior —
   * comprobado de verdad: Atlántico (Madrid) seguía apareciendo tras entrar
   * como Nordwind (Berlín) hasta que algo forzaba un refetch. `session.user.id`
   * cambia entre personas; `getSchoolSlug()` (Tarea 3) cambia al cambiar de
   * escuela con "Cambiar de escuela" sin cambiar de persona. Ninguno de los
   * dos por separado cubre los dos casos.
   */
  const tenantCacheKey =
    session.status === "ready" ? `${session.user.id}:${getSchoolSlug() ?? ""}` : "sin-sesion";

  const timezoneQuery = useQuery({
    queryKey: ["calendar", "school-timezone", tenantCacheKey],
    queryFn: getSchoolTimezone,
  });
  const timeZone = timezoneQuery.data?.timezone;

  const week = useMemo(
    () => (timeZone ? weekRangeContaining(weekAnchor, timeZone) : null),
    [weekAnchor, timeZone],
  );

  const agendaQuery = useQuery({
    queryKey: ["calendar", "agenda", "week", tenantCacheKey, week?.from, week?.to],
    queryFn: () => getAgenda({ from: week!.from, to: week!.to }),
    enabled: Boolean(week),
  });

  // Ver nota de cabecera: independientes de qué semana se esté mirando, y de
  // que exista ya alguna clase programada.
  const coursesQuery = useQuery({
    queryKey: ["calendar", "courses-for-picker", tenantCacheKey],
    queryFn: listCourses,
  });
  const teachersQuery = useQuery({
    queryKey: ["calendar", "teachers-for-picker", tenantCacheKey],
    queryFn: listTeachers,
  });

  const groups = useMemo<GroupOption[]>(() => {
    const options = (coursesQuery.data ?? []).flatMap((course) =>
      course.groups.map((group) => ({ groupId: group.groupId, label: `${course.code} — ${group.name}` })),
    );
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [coursesQuery.data]);

  const teachers = useMemo<TeacherOption[]>(() => {
    const options = (teachersQuery.data ?? []).map((teacher) => ({
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
    }));
    return options.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [teachersQuery.data]);

  function refreshAgenda(): void {
    void queryClient.invalidateQueries({ queryKey: ["calendar", "agenda"] });
  }

  function closeDialog(): void {
    setDialog({ type: "closed" });
  }

  const todayLocalDate = timeZone
    ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(),
      )
    : "";

  if (timezoneQuery.isPending || (agendaQuery.isPending && week)) {
    return (
      <main aria-busy="true">
        <h1>{t("calendar.title")}</h1>
        <p role="status">{t("common.loading")}</p>
        <Skeleton variant="rect" height="32rem" />
      </main>
    );
  }

  if (timezoneQuery.isError || agendaQuery.isError) {
    const error = timezoneQuery.error ?? agendaQuery.error;
    return (
      <main>
        <h1>{t("calendar.title")}</h1>
        <ErrorState
          title={error instanceof ApiError ? describeError(error.problem) : t("calendar.errorTitle")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void timezoneQuery.refetch();
                void agendaQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      </main>
    );
  }

  if (!timeZone || !week) return <></>; // inalcanzable: cubierto por los dos casos de arriba.

  const entries = agendaQuery.data ?? [];

  return (
    <main>
      <h1>{t("calendar.title")}</h1>
      <div>
        <Button variant="ghost" onClick={() => setWeekAnchor((current) => addWeeks(current, -1))}>
          {t("calendar.previousWeek")}
        </Button>
        <Button variant="ghost" onClick={() => setWeekAnchor(new Date())}>
          {t("calendar.today")}
        </Button>
        <Button variant="ghost" onClick={() => setWeekAnchor((current) => addWeeks(current, 1))}>
          {t("calendar.nextWeek")}
        </Button>
        <span>
          {t("calendar.weekRangeLabel", {
            start: formatDate(`${week.days[0]}T00:00:00.000Z`, "UTC", locale, { dateStyle: "medium" }),
            end: formatDate(`${week.days[6]}T00:00:00.000Z`, "UTC", locale, { dateStyle: "medium" }),
          })}
        </span>
        <Button onClick={() => setDialog({ type: "new-session" })}>{t("calendar.newSession")}</Button>
      </div>

      {banner && <p role="status">{banner.text}</p>}

      {entries.length === 0 ? (
        <EmptyState
          title={t("calendar.emptyTitle")}
          description={t("calendar.emptyDescription")}
          action={<Button onClick={() => setDialog({ type: "new-session" })}>{t("calendar.newSession")}</Button>}
        />
      ) : (
        <WeekGrid
          days={week.days}
          entries={entries}
          timeZone={timeZone}
          locale={locale}
          todayLocalDate={todayLocalDate}
          onActivateSession={(session) => setDialog({ type: "menu", session })}
          onDropReschedule={(session, newStartsAtIso) =>
            setDialog({ type: "reschedule", session, prefillStartsAtIso: newStartsAtIso })
          }
        />
      )}

      {dialog.type === "new-session" && (
        <ScheduleSessionDialog
          open
          onClose={closeDialog}
          timeZone={timeZone}
          groups={groups}
          teachers={teachers}
          onScheduled={() => {
            refreshAgenda();
            setBanner({ variant: "success", text: t("calendar.scheduleSuccessToast") });
            closeDialog();
          }}
        />
      )}

      {dialog.type === "menu" && (
        <SessionMenuDialog
          open
          session={dialog.session}
          timeZone={timeZone}
          locale={locale}
          onClose={closeDialog}
          onChooseReschedule={() => setDialog({ type: "reschedule", session: dialog.session })}
          onChooseCancel={() => setDialog({ type: "cancel", session: dialog.session })}
          onChooseAttendance={() => setDialog({ type: "attendance", session: dialog.session })}
        />
      )}

      {dialog.type === "cancel" && (
        <CancelSessionDialog
          open
          session={dialog.session}
          onClose={closeDialog}
          onCancelled={({ refundDue }) => {
            refreshAgenda();
            setBanner({
              variant: "success",
              text: refundDue
                ? t("calendar.cancelSuccessToastRefund")
                : t("calendar.cancelSuccessToastNoRefund"),
            });
            closeDialog();
          }}
        />
      )}

      {dialog.type === "reschedule" && (
        <RescheduleDialog
          open
          session={dialog.session}
          timeZone={timeZone}
          teachers={teachers}
          prefillStartsAtIso={dialog.prefillStartsAtIso}
          onClose={closeDialog}
          onRescheduled={() => {
            refreshAgenda();
            setBanner({ variant: "success", text: t("calendar.rescheduleSuccessToast") });
            closeDialog();
          }}
        />
      )}

      {dialog.type === "attendance" && (
        <AttendanceDialog
          open
          session={dialog.session}
          onClose={closeDialog}
          onRecorded={() => {
            refreshAgenda();
            setBanner({ variant: "success", text: t("calendar.attendanceSuccessToast") });
            closeDialog();
          }}
        />
      )}
    </main>
  );
}
