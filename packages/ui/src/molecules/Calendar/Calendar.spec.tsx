import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "./Calendar.js";
import type { CalendarEvent } from "./Calendar.js";

// Jueves 12 de marzo de 2026: fecha fija para que los tests sean deterministas.
const ANCHOR = new Date(2026, 2, 12);

const EVENTS: CalendarEvent[] = [
  { id: "a", date: "2026-03-12", title: "Clase de conversación", kind: "event", time: "10:00" },
  { id: "b", date: "2026-03-12", title: "Enviar deberes", kind: "task", time: "09:00" },
  { id: "c", date: new Date(2026, 2, 13), title: "Repaso de vocabulario", kind: "reminder" },
];

const fullDay = new Intl.DateTimeFormat("es", { dateStyle: "full" });
const monthTitle = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });

/** Nombre accesible de una celda de día (el `dateLabel` que pasa Calendar). */
function dayName(date: Date): string {
  return fullDay.format(date);
}

function renderCalendar(props: Partial<Parameters<typeof Calendar>[0]> = {}) {
  return render(<Calendar defaultDate={ANCHOR} {...props} />);
}

describe("Calendar", () => {
  it("muestra la vista mes por defecto: rejilla con cabeceras de día de semana", () => {
    renderCalendar();

    expect(screen.getByRole("grid", { name: monthTitle.format(ANCHOR) })).toBeDefined();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    // Cabecera con el mes y el año visibles.
    expect(screen.getByRole("heading", { name: "marzo de 2026" })).toBeDefined();
  });

  it("cambia entre las vistas mes, semana, día y año", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.queryByRole("grid")).toBeNull();
    // La semana del ancla tiene 7 columnas con grupo propio.
    expect(
      screen.getByRole("group", { name: dayName(new Date(2026, 2, 12)) }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Día" }));
    expect(
      screen.getByRole("heading", { name: fullDay.format(ANCHOR) }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Año" }));
    expect(screen.getByRole("button", { name: "Ver marzo de 2026" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Ver diciembre de 2026" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Mes" }));
    expect(screen.getByRole("grid")).toBeDefined();
  });

  it("navega al mes siguiente y anterior, y 'Hoy' vuelve al mes actual", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "abril de 2026" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("heading", { name: "marzo de 2026" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "mayo de 2026" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Hoy" }));
    expect(
      screen.getByRole("heading", { name: monthTitle.format(new Date()) }),
    ).toBeDefined();
  });

  it("con fecha controlada notifica onDateChange al navegar", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    renderCalendar({ date: ANCHOR, onDateChange });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenCalledWith(new Date(2026, 3, 12));
    // La fecha es controlada: la cabecera no cambia sin que el padre la mueva.
    expect(screen.getByRole("heading", { name: "marzo de 2026" })).toBeDefined();
  });

  it("pulsar un día habilitado lo selecciona y notifica onSelectDate", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    renderCalendar({ onSelectDate });

    const day = screen.getByRole("button", { name: dayName(new Date(2026, 2, 17)) });
    await user.click(day);

    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 2, 17));
    expect(day.getAttribute("aria-pressed")).toBe("true");
  });

  it("un día deshabilitado no se puede seleccionar", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    renderCalendar({
      onSelectDate,
      isDateDisabled: (date) => date.getDate() === 17,
    });

    const day = screen.getByRole("button", { name: dayName(new Date(2026, 2, 17)) });
    expect(day.hasAttribute("disabled")).toBe(true);

    await user.click(day);
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("en vista mes marca con puntos los días que tienen eventos", () => {
    renderCalendar({ events: EVENTS });

    const withEvents = screen.getByRole("button", { name: dayName(new Date(2026, 2, 12)) });
    // Dos eventos el día 12 → dos puntos indicadores.
    expect(withEvents.querySelectorAll("[aria-hidden] span")).toHaveLength(2);

    const withoutEvents = screen.getByRole("button", { name: dayName(new Date(2026, 2, 16)) });
    expect(withoutEvents.querySelector("[aria-hidden]")).toBeNull();
  });

  it("en vista semana lista cada evento en la columna de su día", () => {
    renderCalendar({ events: EVENTS, defaultView: "week" });

    const thursday = screen.getByRole("group", { name: dayName(new Date(2026, 2, 12)) });
    expect(within(thursday).getByText("Clase de conversación")).toBeDefined();
    expect(within(thursday).getByText("Enviar deberes")).toBeDefined();
    expect(within(thursday).queryByText("Repaso de vocabulario")).toBeNull();

    const friday = screen.getByRole("group", { name: dayName(new Date(2026, 2, 13)) });
    expect(within(friday).getByText("Repaso de vocabulario")).toBeDefined();
  });

  it("en vista día lista los eventos del día seleccionado ordenados por hora", () => {
    const { container } = renderCalendar({ events: EVENTS, defaultView: "day" });

    const items = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    // 09:00 va antes que 10:00; el evento del día 13 no aparece.
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Enviar deberes");
    expect(items[1]).toContain("Clase de conversación");
  });

  it("en vista día muestra el estado vacío cuando no hay eventos", () => {
    renderCalendar({ defaultView: "day" });

    expect(screen.getByText("Sin eventos")).toBeDefined();
  });

  it("en vista año un mes salta a la vista mes de ese mes", async () => {
    const user = userEvent.setup();
    renderCalendar({ defaultView: "year" });

    await user.click(screen.getByRole("button", { name: "Ver junio de 2026" }));

    expect(screen.getByRole("heading", { name: "junio de 2026" })).toBeDefined();
    expect(screen.getByRole("grid", { name: "junio de 2026" })).toBeDefined();
  });

  it("formatea meses y días de semana con el locale recibido", () => {
    renderCalendar({ locale: "en" });

    expect(screen.getByRole("heading", { name: "March 2026" })).toBeDefined();
    // firstDayOfWeek por defecto es lunes.
    expect(screen.getByRole("columnheader", { name: "Monday" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Sunday" })).toBeDefined();
  });

  it("firstDayOfWeek cambia el orden de las columnas", () => {
    renderCalendar({ firstDayOfWeek: 0 });

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]!.getAttribute("aria-label")).toBe("domingo");
  });

  it("firstDayOfWeek fuera de rango se normaliza con módulo 7", () => {
    renderCalendar({ firstDayOfWeek: 9 }); // 9 % 7 = 2 → martes

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]!.getAttribute("aria-label")).toBe("martes");
  });

  it("con fecha controlada, la vista día sigue a la fecha del padre", () => {
    const { rerender } = render(<Calendar view="day" date={ANCHOR} events={EVENTS} />);

    expect(screen.getByRole("heading", { name: fullDay.format(ANCHOR) })).toBeDefined();
    expect(screen.getByText("Clase de conversación")).toBeDefined();

    const nextDay = new Date(2026, 2, 13);
    rerender(<Calendar view="day" date={nextDay} events={EVENTS} />);

    expect(screen.getByRole("heading", { name: fullDay.format(nextDay) })).toBeDefined();
    expect(screen.getByText("Repaso de vocabulario")).toBeDefined();
    expect(screen.queryByText("Clase de conversación")).toBeNull();
  });

  it("navegar en vista día con fecha controlada no mueve la cabecera sin el padre", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    render(<Calendar view="day" date={ANCHOR} onDateChange={onDateChange} />);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenCalledWith(new Date(2026, 2, 13));
    // La fecha es controlada: la cabecera no cambia sin que el padre la mueva.
    expect(screen.getByRole("heading", { name: fullDay.format(ANCHOR) })).toBeDefined();
  });

  it("en vista semana las columnas sin eventos muestran el estado vacío", () => {
    renderCalendar({ defaultView: "week", events: EVENTS });

    // Semana del 9 al 15 de marzo: eventos el 12 y el 13 → 5 columnas vacías.
    expect(screen.getAllByText("Sin eventos")).toHaveLength(5);
  });

  it("ignora eventos con fecha malformada y avisa en desarrollo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      renderCalendar({
        events: [
          { id: "roto", date: "12/03/2026", title: "Evento roto" },
          { id: "desbordado", date: "2026-02-31", title: "Otro evento roto" },
        ],
      });

      // Ningún punto en el día 12: los eventos inválidos no se agrupan.
      const day = screen.getByRole("button", { name: dayName(new Date(2026, 2, 12)) });
      expect(day.querySelector("[aria-hidden]")).toBeNull();
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});
