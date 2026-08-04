import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "../../atoms/Button/Button.js";
import { CalendarDay } from "../../atoms/CalendarDay/CalendarDay.js";
import { Chip } from "../../atoms/Chip/Chip.js";
import type { ChipVariant } from "../../atoms/Chip/Chip.js";
import { IconChevronLeft, IconChevronRight } from "../../atoms/Icons/Icons.js";

export type CalendarView = "day" | "week" | "month" | "year";
export type CalendarEventKind = "event" | "reminder" | "task";

export interface CalendarEvent {
  /** Identificador estable, usado como key de las listas. */
  id: string;
  /** Día del evento: `Date` o cadena ISO `YYYY-MM-DD` (se interpreta en hora local). */
  date: string | Date;
  /** Título visible (ya traducido). */
  title: string;
  /** Naturaleza del evento: decide la variante semántica del `Chip`. */
  kind?: CalendarEventKind;
  /** Hora opcional ya formateada (p. ej. "09:30"); ordena la lista del día. */
  time?: string;
}

export type CalendarViewLabels = Record<CalendarView, string>;
export type CalendarKindLabels = Record<CalendarEventKind, string>;

export interface CalendarProps {
  /** Vista controlada. Si no se pasa, la gestiona el componente (`defaultView`). */
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Fecha visible (ancla), controlada. Si no se pasa, `defaultDate`. */
  date?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  /** Notifica el día pulsado en las vistas mes/semana. */
  onSelectDate?: (date: Date) => void;
  events?: CalendarEvent[];
  /** Días no seleccionables (fines de semana, pasados, etc.). */
  isDateDisabled?: (date: Date) => boolean;
  /** Locale BCP-47 para `Intl.DateTimeFormat` (nombres de mes y días). */
  locale?: string;
  /** Primer día de la semana: 0 = domingo … 6 = sábado. Por defecto lunes. */
  firstDayOfWeek?: number;
  previousLabel?: string;
  nextLabel?: string;
  todayLabel?: string;
  /** Nombres de las vistas en el selector segmentado. */
  viewLabels?: CalendarViewLabels;
  /** Nombre accesible del grupo de botones de vista. */
  viewGroupLabel?: string;
  /** Nombres de los tipos de evento en los chips. */
  kindLabels?: CalendarKindLabels;
  /** Texto cuando un día no tiene eventos (vistas día/semana). */
  emptyEventsLabel?: string;
  /** Nombre accesible del botón de cada mes en la vista año. */
  goToMonthLabel?: (monthName: string, year: number) => string;
}

// --- Utilidades de fechas: `Date` nativo, sin librerías. ---

/** Recorta la hora: las comparaciones del calendario son siempre por día civil. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/** Suma meses sin desbordar: 31 de enero + 1 mes = 28/29 de febrero. */
function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

/**
 * Normaliza la fecha de un evento. La cadena `YYYY-MM-DD` se parsea a mano:
 * `new Date("2026-03-12")` la interpreta en UTC y en zonas negativas cae en el
 * día anterior.
 */
function parseEventDate(date: string | Date): Date {
  if (date instanceof Date) {
    return startOfDay(date);
  }
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Lunes (o el `firstDayOfWeek` pedido) de la semana que contiene `date`. */
function startOfWeek(date: Date, firstDayOfWeek: number): Date {
  const diff = (date.getDay() - firstDayOfWeek + 7) % 7;
  return addDays(date, -diff);
}

/** Clave de agrupación por día civil para indexar eventos. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// --- Constantes de presentación. ---

const DAYS_PER_WEEK = 7;
/** Rejilla de mes fija de 6 semanas: altura estable al cambiar de mes. */
const GRID_WEEKS = 6;

const VIEW_ORDER: CalendarView[] = ["day", "week", "month", "year"];

const DEFAULT_VIEW_LABELS: CalendarViewLabels = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
};

const DEFAULT_KIND_LABELS: CalendarKindLabels = {
  event: "Evento",
  reminder: "Recordatorio",
  task: "Tarea",
};

/** Cada tipo de evento usa una variante semántica del Chip: nunca solo color libre. */
const KIND_VARIANT: Record<CalendarEventKind, ChipVariant> = {
  event: "accent",
  reminder: "warning",
  task: "success",
};

const containerStyles =
  "flex w-full min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4";
const headerStyles = "flex flex-wrap items-center justify-between gap-3";
const navGroupStyles = "flex items-center gap-1";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const viewGroupStyles = "flex items-center gap-1";
const monthGridStyles = "flex flex-col gap-1";
const weekRowStyles = "grid grid-cols-7 gap-1";
const columnHeaderStyles =
  "flex h-8 items-center justify-center font-sans text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-muted";
const cellStyles = "flex justify-center";
const weekStyles = "grid grid-cols-7 gap-2";
const weekColumnStyles =
  "flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface-secondary p-2";
const weekColumnHeaderStyles = "flex flex-col items-center gap-1";
const weekdayNameStyles =
  "font-sans text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-muted";
const eventListStyles = "m-0 flex list-none flex-col gap-1.5 p-0";
const eventItemStyles = "flex min-w-0 flex-col items-start gap-1";
const eventTimeStyles =
  "font-sans text-[length:var(--ink-text-xs)] leading-[var(--ink-leading-xs)] font-medium text-muted";
const eventTitleStyles =
  "font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-text";
const emptyStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";
const yearGridStyles = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";
const miniMonthStyles = "flex flex-col items-center gap-1";
const miniGridStyles = "grid grid-cols-7 gap-0.5 text-center";
const miniDayStyles =
  "font-sans text-[length:var(--ink-text-xs)] leading-4 text-text data-[outside]:text-[var(--ink-text-disabled)]";

/**
 * Calendario con vistas día/semana/mes/año. Compone `CalendarDay` (rejilla y
 * puntos de eventos), `Button` (navegación y vistas), `Chip` (tipo de evento)
 * e `Icons` (cheurones). Todas las fechas son `Date` nativo en hora local y
 * los nombres de mes/día salen de `Intl.DateTimeFormat` con el `locale` dado.
 *
 * Limitación conocida: la rejilla de mes no tiene navegación por teclado con
 * flechas (roving tabindex); se tabula celda a celda.
 */
export function Calendar({
  view: viewProp,
  defaultView = "month",
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  onSelectDate,
  events = [],
  isDateDisabled,
  locale = "es",
  firstDayOfWeek = 1,
  previousLabel = "Anterior",
  nextLabel = "Siguiente",
  todayLabel = "Hoy",
  viewLabels = DEFAULT_VIEW_LABELS,
  viewGroupLabel = "Vista del calendario",
  kindLabels = DEFAULT_KIND_LABELS,
  emptyEventsLabel = "Sin eventos",
  goToMonthLabel = (monthName, year) => `Ver ${monthName} de ${year}`,
}: CalendarProps): ReactElement {
  const [innerView, setInnerView] = useState<CalendarView>(defaultView);
  const [innerDate, setInnerDate] = useState<Date>(() => startOfDay(defaultDate ?? new Date()));
  const view = viewProp ?? innerView;
  const anchor = startOfDay(dateProp ?? innerDate);
  // Día seleccionado: lo marca la rejilla y es el día que detalla la vista día.
  const [selected, setSelected] = useState<Date>(() =>
    startOfDay(dateProp ?? defaultDate ?? new Date()),
  );

  const setView = (next: CalendarView): void => {
    if (viewProp === undefined) {
      setInnerView(next);
    }
    onViewChange?.(next);
  };

  const setAnchor = (next: Date): void => {
    if (dateProp === undefined) {
      setInnerDate(next);
    }
    onDateChange?.(next);
  };

  // Formateadores Intl: se recrean solo cuando cambia el locale.
  const formats = useMemo(
    () => ({
      monthTitle: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      dayFull: new Intl.DateTimeFormat(locale, { dateStyle: "full" }),
      dayMedium: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
      weekdayShort: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
      weekdayNarrow: new Intl.DateTimeFormat(locale, { weekday: "narrow" }),
      monthLong: new Intl.DateTimeFormat(locale, { month: "long" }),
      year: new Intl.DateTimeFormat(locale, { year: "numeric" }),
    }),
    [locale],
  );

  // Eventos indexados por día civil para no recorrer la lista por cada celda.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(parseEventDate(event.date));
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(anchor, firstDayOfWeek);
  const weekDays = Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(weekStart, i));

  // Celdas de la rejilla de mes: 42 días empezando en la semana del día 1.
  const monthDays = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first, firstDayOfWeek);
    return Array.from({ length: GRID_WEEKS * DAYS_PER_WEEK }, (_, i) => addDays(start, i));
  }, [anchor, firstDayOfWeek]);

  /** Paso temporal según la vista: 1 día, 1 semana, 1 mes o 1 año. */
  const shift = (from: Date, step: number): Date => {
    switch (view) {
      case "day":
        return addDays(from, step);
      case "week":
        return addDays(from, step * DAYS_PER_WEEK);
      case "month":
        return addMonths(from, step);
      case "year":
        return addMonths(from, step * 12);
    }
  };

  const navigate = (step: number): void => {
    // En vista día la fecha visible y la seleccionada son la misma.
    const base = view === "day" ? selected : anchor;
    const next = shift(base, step);
    setAnchor(next);
    if (view === "day") {
      setSelected(next);
    }
  };

  const goToday = (): void => {
    setAnchor(today);
    setSelected(today);
  };

  const handleSelect = (day: Date): void => {
    const date = startOfDay(day);
    setSelected(date);
    onSelectDate?.(date);
  };

  const goToMonth = (month: number): void => {
    setAnchor(new Date(anchor.getFullYear(), month, 1));
    setView("month");
  };

  const title =
    view === "month"
      ? formats.monthTitle.format(anchor)
      : view === "year"
        ? formats.year.format(anchor)
        : view === "week"
          ? `${formats.dayMedium.format(weekStart)} – ${formats.dayMedium.format(addDays(weekStart, DAYS_PER_WEEK - 1))}`
          : formats.dayFull.format(selected);

  /** Eventos de un día, ordenados por hora (los sin hora primero). */
  const eventsOf = (day: Date): CalendarEvent[] =>
    [...(eventsByDay.get(dayKey(day)) ?? [])].sort((a, b) =>
      (a.time ?? "").localeCompare(b.time ?? ""),
    );

  const renderEventItem = (event: CalendarEvent): ReactElement => (
    <li key={event.id} className={eventItemStyles}>
      {event.time && <span className={eventTimeStyles}>{event.time}</span>}
      <Chip variant={KIND_VARIANT[event.kind ?? "event"]}>
        {kindLabels[event.kind ?? "event"]}
      </Chip>
      <span className={eventTitleStyles}>{event.title}</span>
    </li>
  );

  const renderMonth = (): ReactElement => (
    <div role="grid" aria-label={title} className={monthGridStyles}>
      <div role="row" className={weekRowStyles}>
        {weekDays.map((day) => (
          <span
            key={dayKey(day)}
            role="columnheader"
            aria-label={formats.weekdayLong.format(day)}
            className={columnHeaderStyles}
          >
            {formats.weekdayShort.format(day)}
          </span>
        ))}
      </div>
      {Array.from({ length: GRID_WEEKS }, (_, weekIndex) => (
        <div role="row" key={weekIndex} className={weekRowStyles}>
          {monthDays
            .slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK)
            .map((day) => (
              <div role="gridcell" key={dayKey(day)} className={cellStyles}>
                <CalendarDay
                  date={day}
                  selected={isSameDay(day, selected)}
                  isToday={isSameDay(day, today)}
                  disabled={isDateDisabled?.(day) ?? false}
                  outsideMonth={day.getMonth() !== anchor.getMonth()}
                  eventCount={(eventsByDay.get(dayKey(day)) ?? []).length}
                  dateLabel={formats.dayFull.format(day)}
                  onSelect={handleSelect}
                />
              </div>
            ))}
        </div>
      ))}
    </div>
  );

  const renderWeek = (): ReactElement => (
    <div className={weekStyles} aria-label={title}>
      {weekDays.map((day) => {
        const dayEvents = eventsOf(day);
        return (
          <section
            key={dayKey(day)}
            role="group"
            aria-label={formats.dayFull.format(day)}
            className={weekColumnStyles}
          >
            <div className={weekColumnHeaderStyles}>
              <span className={weekdayNameStyles}>{formats.weekdayShort.format(day)}</span>
              <CalendarDay
                date={day}
                selected={isSameDay(day, selected)}
                isToday={isSameDay(day, today)}
                disabled={isDateDisabled?.(day) ?? false}
                dateLabel={formats.dayFull.format(day)}
                onSelect={handleSelect}
              />
            </div>
            {dayEvents.length > 0 && (
              <ul className={eventListStyles}>{dayEvents.map(renderEventItem)}</ul>
            )}
          </section>
        );
      })}
    </div>
  );

  const renderDay = (): ReactElement => {
    const dayEvents = eventsOf(selected);
    return (
      <section role="group" aria-label={title} className="flex flex-col gap-2">
        {dayEvents.length === 0 ? (
          <p className={emptyStyles}>{emptyEventsLabel}</p>
        ) : (
          <ul className={eventListStyles}>{dayEvents.map(renderEventItem)}</ul>
        )}
      </section>
    );
  };

  const renderYear = (): ReactElement => (
    <div className={yearGridStyles}>
      {Array.from({ length: 12 }, (_, month) => {
        const first = new Date(anchor.getFullYear(), month, 1);
        const monthName = formats.monthLong.format(first);
        // Mini-rejilla decorativa: la navegación la da el botón del mes.
        const start = startOfWeek(first, firstDayOfWeek);
        const cells = Array.from({ length: GRID_WEEKS * DAYS_PER_WEEK }, (_, i) =>
          addDays(start, i),
        );
        return (
          <div key={month} className={miniMonthStyles}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={goToMonthLabel(monthName, anchor.getFullYear())}
              onClick={() => goToMonth(month)}
            >
              {monthName}
            </Button>
            <div aria-hidden="true" className={miniGridStyles}>
              {weekDays.map((day) => (
                <span key={`w-${dayKey(day)}`} className="text-muted font-sans text-[length:var(--ink-text-xs)] leading-4">
                  {formats.weekdayNarrow.format(day)}
                </span>
              ))}
              {cells.map((day) => (
                <span
                  key={dayKey(day)}
                  className={miniDayStyles}
                  data-outside={day.getMonth() !== month || undefined}
                >
                  {day.getDate()}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <div className={navGroupStyles}>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<IconChevronLeft />}
            onClick={() => navigate(-1)}
          >
            <span className="sr-only">{previousLabel}</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            {todayLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<IconChevronRight />}
            onClick={() => navigate(1)}
          >
            <span className="sr-only">{nextLabel}</span>
          </Button>
        </div>
        {/* aria-live: anuncia el nuevo periodo al navegar entre meses/años. */}
        <h2 className={titleStyles} aria-live="polite">
          {title}
        </h2>
        <div role="group" aria-label={viewGroupLabel} className={viewGroupStyles}>
          {VIEW_ORDER.map((option) => (
            <Button
              key={option}
              variant={option === view ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={option === view}
              onClick={() => setView(option)}
            >
              {viewLabels[option]}
            </Button>
          ))}
        </div>
      </div>
      {view === "month" && renderMonth()}
      {view === "week" && renderWeek()}
      {view === "day" && renderDay()}
      {view === "year" && renderYear()}
    </div>
  );
}
