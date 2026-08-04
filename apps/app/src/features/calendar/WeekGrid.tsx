import { useMemo } from "react";
import type { DragEvent, ReactElement } from "react";
import type { AgendaEntry } from "@langopia/contracts";
import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";
import { useT } from "../../i18n/translate.js";
import { Chip } from "@langopia/ui";
import type { ChipVariant } from "@langopia/ui";
import { layoutDayLanes } from "./day-lanes.js";
import { teacherColorIndex } from "./teacher-color.js";
import { zonedDateAndMinutes, zonedTimeToUtcIso } from "./zoned-time.js";

/** Ventana visible de la cuadrícula: cubre con margen las horas del seed (08:00–20:00 locales, en las tres escuelas). */
const HOUR_START = 6;
const HOUR_END = 22;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;

const STATUS_TAG_VARIANT: Record<string, ChipVariant> = {
  scheduled: "neutral",
  in_progress: "success",
  completed: "success",
  canceled_by_school: "critical",
  canceled_by_student: "critical",
  rescheduled: "warning",
  no_show: "warning",
};

/**
 * Hasta este número de carriles solapados, el reparto fluido del ancho sigue
 * siendo legible. Por encima, la pista del día crece (`LANE_MIN_WIDTH_REM`
 * por carril) y la columna desplaza horizontalmente: con el seed real (~30
 * clases solapadas por hueco), repartir el 100 % entre todos dejaba tarjetas
 * de una palabra por línea.
 */
const MAX_FLUID_LANES = 3;
const LANE_MIN_WIDTH_REM = 8.5;

/* Paleta por profesor (índice decidido por `teacher-color.ts`): ocho tonos
   distintos entre sí y del neutro por defecto (sin profesor asignado, ver
   `SESSION_NEUTRAL_TONE`). Los valores concretos son deliberadamente
   saturados y variados para que un vistazo rápido distinga profesores sin
   depender del texto — el texto (nombre del profesor) sigue presente
   siempre, el color nunca es la única señal. */
const TEACHER_COLOR_TONES: Record<number, string> = {
  0: "border-[#a8c5f5] bg-[#e8f0fe] text-[#1a3d7c]",
  1: "border-[#f3b3a3] bg-[#fdece8] text-[#7c2b1a]",
  2: "border-[#9fe0bf] bg-[#e8fbf1] text-[#14532d]",
  3: "border-[#f0cd97] bg-[#fdf3e8] text-[#7a4a08]",
  4: "border-[#d3a8f5] bg-[#f3e8fd] text-[#4c1a7c]",
  5: "border-[#9adaf0] bg-[#e8f9fd] text-[#0b4a5e]",
  6: "border-[#eadd93] bg-[#fdf8e8] text-[#5c4e08]",
  7: "border-[#f2a8cc] bg-[#fdeaf3] text-[#7c1a4e]",
};

/* Clase sin profesor asignado: el neutro suave del sistema de diseño. */
const SESSION_NEUTRAL_TONE =
  "border-border-strong bg-[var(--ink-neutral-soft-bg)] text-[var(--ink-neutral-soft-text)]";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface WeekGridProps {
  /** Las 7 fechas locales "YYYY-MM-DD", de lunes a domingo, en la zona de la escuela. */
  days: string[];
  entries: AgendaEntry[];
  timeZone: string;
  locale: Locale;
  todayLocalDate: string;
  onActivateSession: (session: AgendaEntry) => void;
  /** Arrastrar y soltar (Paso 4): mueve `session` al día y la hora en punto del hueco soltado. Requiere confirmación aparte — ver `RescheduleDialog`. */
  onDropReschedule: (session: AgendaEntry, newStartsAtIso: string) => void;
}

/**
 * Vista semanal (Paso 1 del brief): las clases posicionadas por hora, coloreadas
 * por profesor, en la zona horaria de LA ESCUELA — nunca la del navegador.
 *
 * El arrastrar y soltar (Paso 4) tiene alternativa de teclado: activar una
 * clase (Enter/clic, con foco nativo de `<button>`) abre el menú de acciones
 * de `CalendarScreen`, con "Reprogramar" entre ellas — el mismo diálogo de
 * confirmación que usa soltar una clase arrastrada, así que todo el flujo es
 * operable sin ratón.
 */
export function WeekGrid({
  days,
  entries,
  timeZone,
  locale,
  todayLocalDate,
  onActivateSession,
  onDropReschedule,
}: WeekGridProps): ReactElement {
  const t = useT();

  const entriesByDay = useMemo(() => {
    const withPosition = entries.map((entry) => {
      const start = zonedDateAndMinutes(entry.start, timeZone);
      const end = zonedDateAndMinutes(entry.end, timeZone);
      return { entry, date: start.date, startMinutes: start.minutes, endMinutes: end.minutes };
    });
    type PositionedEntry = (typeof withPosition)[number];

    const byDay = new Map<string, PositionedEntry[]>();
    for (const day of days) byDay.set(day, []);
    for (const item of withPosition) {
      const bucket = byDay.get(item.date);
      if (bucket) bucket.push(item);
    }

    const laidOut = new Map<string, Array<PositionedEntry & { lane: number; laneCount: number }>>();
    for (const [day, items] of byDay) laidOut.set(day, layoutDayLanes(items));

    // Carriles máximos por día: a partir de cierto solape, repartir el ancho
    // entre todos deja tarjetas ilegibles (una palabra por línea). En vez de
    // eso, la pista del día crece y la columna desplaza horizontalmente.
    const maxLanesByDay = new Map<string, number>();
    for (const [day, items] of laidOut) {
      maxLanesByDay.set(day, items.reduce((max, item) => Math.max(max, item.laneCount), 1));
    }
    return { laidOut, maxLanesByDay };
  }, [entries, days, timeZone]);

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index);

  function handleDrop(event: DragEvent<HTMLDivElement>, day: string, hour: number): void {
    event.preventDefault();
    const sessionId = event.dataTransfer.getData("text/plain");
    const session = entries.find((entry) => entry.sessionId === sessionId);
    if (!session) return;
    const newStartsAtIso = zonedTimeToUtcIso(`${day}T${pad(hour)}:00`, timeZone);
    onDropReschedule(session, newStartsAtIso);
  }

  return (
    <div className="overflow-hidden rounded-[var(--ink-radius-lg)] border border-border bg-surface">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(6.5rem,1fr))] border-b border-border bg-surface-secondary">
        <div className="border-r border-border" />
        {days.map((day) => (
          <div
            key={day}
            className={`border-l border-border p-2 text-center font-semibold text-[length:var(--ink-text-sm)] ${
              day === todayLocalDate ? "bg-[var(--ink-accent-subtle-bg)] text-[var(--ink-accent-subtle-text)]" : ""
            }`}
            data-today={day === todayLocalDate || undefined}
          >
            {formatDate(`${day}T00:00:00.000Z`, "UTC", locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
        ))}
      </div>
      <div className="grid max-h-[42rem] grid-cols-[3.5rem_repeat(7,minmax(6.5rem,1fr))] overflow-y-auto">
        <div className="border-r border-border">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-14 -translate-y-[0.5em] pr-2 text-right font-mono text-xs text-[color:var(--ink-text-tertiary)]"
            >
              {pad(hour)}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayEntries = entriesByDay.laidOut.get(day) ?? [];
          const maxLanes = entriesByDay.maxLanesByDay.get(day) ?? 1;
          return (
          <div key={day} className="overflow-x-auto border-l border-border">
            {/* Pista del día: contexto de posicionamiento de las tarjetas.
                Cuando hay muchos carriles solapados crece con el `minWidth` en
                línea de abajo y la columna la desplaza horizontalmente. */}
            <div
              className="relative h-full min-w-full"
              style={maxLanes > MAX_FLUID_LANES ? { minWidth: `${maxLanes * LANE_MIN_WIDTH_REM}rem` } : undefined}
            >
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-14 border-b border-dashed border-border"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, day, hour)}
              />
            ))}
            {dayEntries.map(({ entry, startMinutes, endMinutes, lane, laneCount }) => {
              const top = Math.max(
                0,
                Math.min(100, ((startMinutes - HOUR_START * 60) / TOTAL_MINUTES) * 100),
              );
              const bottom = Math.max(
                0,
                Math.min(100, ((endMinutes - HOUR_START * 60) / TOTAL_MINUTES) * 100),
              );
              const teacherColor = teacherColorIndex(entry.teacherId);
              const timeRange = `${formatDate(entry.start, timeZone, locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}–${formatDate(entry.end, timeZone, locale, { hour: "2-digit", minute: "2-digit" })}`;
              const teacherLabel = entry.teacherName ?? t("calendar.sessionMenuTeacherUnassigned");
              const statusLabel = t(`calendar.status.${entry.status}`);
              const isCanceled =
                entry.status === "canceled_by_school" || entry.status === "canceled_by_student";
              const tone =
                teacherColor === null ? SESSION_NEUTRAL_TONE : TEACHER_COLOR_TONES[teacherColor];

              return (
                <button
                  key={entry.sessionId}
                  type="button"
                  className={`absolute box-border flex min-h-11 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-[var(--ink-radius-sm)] border px-2 py-1 text-left text-xs leading-4 focus-visible:z-[5] ${tone} ${isCanceled ? "line-through opacity-70" : ""}`}
                  data-status={entry.status}
                  data-teacher-color={teacherColor ?? undefined}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", entry.sessionId)}
                  onClick={() => onActivateSession(entry)}
                  style={{
                    top: `${top}%`,
                    height: `${Math.max(bottom - top, 4)}%`,
                    left: `${(lane / laneCount) * 100}%`,
                    width: `${100 / laneCount}%`,
                  }}
                  aria-label={`${entry.groupName} · ${timeRange} · ${teacherLabel} · ${statusLabel}`}
                >
                  <span className="truncate font-semibold">{entry.groupName}</span>
                  <span className="truncate opacity-85">{timeRange}</span>
                  <span className="truncate opacity-85">{teacherLabel}</span>
                  <Chip variant={STATUS_TAG_VARIANT[entry.status] ?? "neutral"}>{statusLabel}</Chip>
                </button>
              );
            })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
