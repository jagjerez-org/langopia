import { forwardRef } from "react";
import type { ReactElement } from "react";

export interface CalendarDayProps {
  /** Fecha de la celda; solo se muestra el número del día. */
  date: Date;
  /** Día seleccionado (lo controla el calendario padre). */
  selected?: boolean;
  /** Día de hoy: se marca con un anillo de acento y `aria-current="date"`. */
  isToday?: boolean;
  disabled?: boolean;
  /** Día de otro mes dentro de la rejilla visible: se atenúa. */
  outsideMonth?: boolean;
  /** Número de eventos del día; se muestran como puntos indicadores (máx. 3). */
  eventCount?: number;
  /**
   * Nombre accesible completo de la fecha, ya traducido (p. ej. "lunes 3 de
   * marzo de 2026"). Sin él, el nombre accesible es solo el número del día.
   */
  dateLabel?: string;
  /** Notifica la fecha al pulsar la celda. */
  onSelect?: (date: Date) => void;
}

const dayStyles = [
  // Base: celda redonda con el número centrado; foco visible.
  "inline-flex h-9 w-9 cursor-pointer appearance-none flex-col items-center justify-center gap-0.5 rounded-full border-none bg-transparent p-0 font-sans text-[length:var(--ink-text-base)] leading-none text-text transition-[background-color,color,box-shadow] duration-fast not-disabled:hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-[var(--ink-text-disabled)] disabled:hover:bg-transparent",
  // Fuera del mes: atenuado.
  "data-[outside]:text-muted",
  // Hoy: anillo de acento, visible también cuando el día está seleccionado.
  "data-[today]:font-semibold data-[today]:shadow-[inset_0_0_0_1.5px_var(--ink-accent-default)]",
  // Seleccionado: fondo primario.
  "data-[selected]:bg-primary data-[selected]:text-primary-text data-[selected]:not-disabled:hover:bg-[var(--ink-primary-solid-hover)]",
].join(" ");

/** Puntos indicadores de eventos, como mucho tres. */
const MAX_DOTS = 3;

/**
 * Celda de día de un calendario. Es presentacional: recibe la fecha y los
 * estados por props y notifica `onSelect`; la rejilla (semana/mes) y la
 * navegación entre meses las aportarán las moléculas de calendario.
 */
export const CalendarDay = forwardRef<HTMLButtonElement, CalendarDayProps>(function CalendarDay(
  {
    date,
    selected = false,
    isToday = false,
    disabled = false,
    outsideMonth = false,
    eventCount = 0,
    dateLabel,
    onSelect,
  },
  ref,
): ReactElement {
  const dots = Math.min(Math.max(eventCount, 0), MAX_DOTS);

  return (
    <button
      ref={ref}
      type="button"
      className={dayStyles}
      data-selected={selected || undefined}
      data-today={isToday || undefined}
      data-outside={outsideMonth || undefined}
      aria-label={dateLabel}
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
      disabled={disabled}
      onClick={() => onSelect?.(date)}
    >
      <span>{date.getDate()}</span>
      {dots > 0 && (
        <span className="flex h-1 items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: dots }, (_, index) => (
            <span key={index} className="h-1 w-1 rounded-full bg-current" />
          ))}
        </span>
      )}
    </button>
  );
});
