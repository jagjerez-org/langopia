import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { Calendar } from "../../molecules/Calendar/Calendar.js";
import type { CalendarEvent, CalendarProps } from "../../molecules/Calendar/Calendar.js";
import { CrudForm } from "../../molecules/CrudForm/CrudForm.js";
import type { CrudField, CrudFormValues } from "../../molecules/CrudForm/CrudForm.js";
import { ListRow } from "../../molecules/ListRow/ListRow.js";
import { Section } from "../../molecules/Section/Section.js";

export type PlanningSessionStatus = "scheduled" | "completed" | "cancelled";

export interface PlanningSession {
  /** Clave estable de la sesión. */
  id: string;
  /** Día de la sesión: `Date` o cadena ISO `YYYY-MM-DD` (hora local). */
  date: string | Date;
  /** Hora ya formateada (p. ej. "09:30"); ordena el detalle del día. */
  time?: string;
  title: string;
  teacher?: string;
  status: PlanningSessionStatus;
}

/** Acción del menú de cada sesión del día (editar, cancelar…). */
export interface PlanningSessionAction {
  id: string;
  /** Texto de la acción (ya traducido). */
  label: string;
}

export interface PlanningPageLabels {
  /** Título de la página. */
  title: string;
  /** Nombre accesible de la región con el detalle del día. */
  dayDetailListLabel: string;
  /** Texto cuando el día seleccionado no tiene sesiones. */
  emptyDayLabel: string;
  /** Botón que muestra el formulario de alta. */
  createEventLabel: string;
  /** Título de la sección con el formulario de alta. */
  createEventTitle: string;
  /** Botón de enviar el formulario de alta. */
  submitEventLabel: string;
  cancelLabel: string;
  /** Texto de cada estado en los chips de las sesiones. */
  statusLabels: Record<PlanningSessionStatus, string>;
  /** Nombre accesible del menú de acciones de cada sesión. */
  sessionActionsLabel: (sessionTitle: string) => string;
}

/** Props de `Calendar` que la página no gobierna (eventos, fecha y selección). */
export type PlanningCalendarProps = Omit<
  Partial<CalendarProps>,
  "events" | "date" | "defaultDate" | "onSelectDate"
>;

export interface PlanningPageProps {
  sessions: PlanningSession[];
  /** Campos del formulario de alta (misma descripción que `CrudForm`). */
  createFields: CrudField[];
  /** Acciones del menú de cada sesión del detalle del día. */
  sessionActions?: PlanningSessionAction[];
  /** Textos de la interfaz, ya traducidos. */
  labels: PlanningPageLabels;
  /** Fecha visible inicial del calendario; por defecto hoy. */
  initialDate?: Date;
  /** Personalización de textos/vista del `Calendar` interno. */
  calendarProps?: PlanningCalendarProps;
  /** Notifica el día seleccionado en el calendario. */
  onSelectDate?: (date: Date) => void;
  /** Recibe los valores del formulario de alta. */
  onCreateEvent: (values: CrudFormValues) => void;
  /** Notifica la acción elegida con el id de la sesión y el de la acción. */
  onEventAction?: (sessionId: string, actionId: string) => void;
}

/** Cada estado usa una variante semántica del Chip: nunca solo color libre. */
const STATUS_VARIANT: Record<PlanningSessionStatus, ChipVariant> = {
  scheduled: "accent",
  completed: "success",
  cancelled: "critical",
};

const wrapperStyles = "flex w-full flex-col gap-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const columnsStyles = "grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_20rem]";
const detailStyles = "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4";
const detailTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const sessionListStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const emptyStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/** Recorta la hora: las comparaciones son siempre por día civil. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Clave de agrupación por día civil (misma regla que el `Calendar`). */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Parsea la fecha de una sesión a día civil local; `null` si no es válida. */
function parseSessionDate(date: string | Date): Date | null {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Página de planificación: la molécula `Calendar` con las sesiones como
 * eventos y, al lado, el detalle del día seleccionado (una `ListRow` por
 * sesión con hora, profesorado, estado y menú de acciones). El alta de
 * sesiones es un `CrudForm` inline que se despliega desde la barra de
 * acciones. Sin API: todo llega por props y se notifica por callbacks.
 */
export function PlanningPage({
  sessions,
  createFields,
  sessionActions,
  labels,
  initialDate,
  calendarProps,
  onSelectDate,
  onCreateEvent,
  onEventAction,
}: PlanningPageProps): ReactElement {
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(initialDate ?? new Date()),
  );
  const [isCreating, setIsCreating] = useState(false);

  // Sesiones indexadas por día civil para el detalle; inválidas se ignoran.
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, PlanningSession[]>();
    for (const session of sessions) {
      const parsed = parseSessionDate(session.date);
      if (!parsed) {
        continue;
      }
      const key = dayKey(parsed);
      const list = map.get(key);
      if (list) {
        list.push(session);
      } else {
        map.set(key, [session]);
      }
    }
    return map;
  }, [sessions]);

  const daySessions = [...(sessionsByDay.get(dayKey(selectedDate)) ?? [])].sort((a, b) =>
    (a.time ?? "").localeCompare(b.time ?? ""),
  );

  const calendarEvents: CalendarEvent[] = sessions.map((session) => ({
    id: session.id,
    date: session.date,
    title: session.title,
    time: session.time,
  }));

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    onSelectDate?.(date);
  };

  const createEvent = (values: CrudFormValues) => {
    onCreateEvent(values);
    setIsCreating(false);
  };

  const locale = calendarProps?.locale ?? "es";
  const dayTitle = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(selectedDate);

  return (
    <div className={wrapperStyles}>
      <h1 className={titleStyles}>{labels.title}</h1>
      <ActionBar
        actions={[
          {
            label: labels.createEventLabel,
            variant: "primary",
            onClick: () => setIsCreating(true),
          },
        ]}
      />
      {isCreating && (
        <Section title={labels.createEventTitle}>
          <CrudForm
            fields={createFields}
            onSubmit={createEvent}
            onCancel={() => setIsCreating(false)}
            submitLabel={labels.submitEventLabel}
            cancelLabel={labels.cancelLabel}
          />
        </Section>
      )}
      <div className={columnsStyles}>
        <Calendar
          {...calendarProps}
          defaultDate={initialDate}
          events={calendarEvents}
          onSelectDate={selectDate}
        />
        <section aria-label={labels.dayDetailListLabel} className={detailStyles}>
          <h2 className={detailTitleStyles}>{dayTitle}</h2>
          {daySessions.length === 0 ? (
            <p className={emptyStyles}>{labels.emptyDayLabel}</p>
          ) : (
            <ul className={sessionListStyles}>
              {daySessions.map((session) => (
                <li key={session.id}>
                  <ListRow
                    title={session.title}
                    subtitle={[session.time, session.teacher].filter(Boolean).join(" · ")}
                    tags={[
                      {
                        label: labels.statusLabels[session.status],
                        variant: STATUS_VARIANT[session.status],
                      },
                    ]}
                    actions={
                      sessionActions !== undefined && onEventAction !== undefined
                        ? sessionActions.map((action) => ({
                            label: action.label,
                            onClick: () => onEventAction(session.id, action.id),
                          }))
                        : undefined
                    }
                    actionsLabel={labels.sessionActionsLabel(session.title)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
