import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { CalendarDay } from "./CalendarDay.js";

const DATE = new Date(2026, 2, 12); // 12 de marzo de 2026

function renderDay(props: Partial<Parameters<typeof CalendarDay>[0]> = {}) {
  return render(<CalendarDay date={DATE} {...props} />);
}

describe("CalendarDay", () => {
  it("muestra el número del día de la fecha recibida", () => {
    renderDay();

    expect(screen.getByRole("button", { name: "12" })).not.toBeNull();
  });

  it("notifica la fecha completa al pulsar", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderDay({ onSelect });

    await user.click(screen.getByRole("button", { name: "12" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(DATE);
  });

  it("selected se expone con aria-pressed y data-selected", () => {
    renderDay({ selected: true });

    const day = screen.getByRole("button", { name: "12" });
    expect(day.getAttribute("aria-pressed")).toBe("true");
    expect(day.getAttribute("data-selected")).toBe("true");
  });

  it('isToday se expone con aria-current="date"', () => {
    renderDay({ isToday: true });

    const day = screen.getByRole("button", { name: "12" });
    expect(day.getAttribute("aria-current")).toBe("date");
    expect(day.getAttribute("data-today")).toBe("true");
  });

  it("disabled bloquea la celda y no notifica", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderDay({ disabled: true, onSelect });

    const day = screen.getByRole("button", { name: "12" });
    expect(day.hasAttribute("disabled")).toBe(true);

    await user.click(day);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("outsideMonth atenúa la celda vía data-outside", () => {
    renderDay({ outsideMonth: true });

    expect(screen.getByRole("button", { name: "12" }).getAttribute("data-outside")).toBe("true");
  });

  it("muestra un punto por evento, con un máximo de tres", () => {
    const { container, rerender } = render(<CalendarDay date={DATE} eventCount={2} />);
    expect(container.querySelectorAll("[aria-hidden='true'] span")).toHaveLength(2);

    rerender(<CalendarDay date={DATE} eventCount={7} />);
    expect(container.querySelectorAll("[aria-hidden='true'] span")).toHaveLength(3);

    rerender(<CalendarDay date={DATE} eventCount={0} />);
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("dateLabel sustituye al número como nombre accesible", () => {
    renderDay({ dateLabel: "jueves 12 de marzo de 2026" });

    expect(screen.getByRole("button", { name: "jueves 12 de marzo de 2026" })).not.toBeNull();
  });

  it("reenvía la ref al elemento button", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<CalendarDay ref={ref} date={DATE} />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
