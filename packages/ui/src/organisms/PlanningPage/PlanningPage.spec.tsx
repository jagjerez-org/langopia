import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  planningCreateFields,
  planningPageLabels,
  planningSessionActions,
  planningSessions,
} from "../../fixtures/management.js";
import { PlanningPage } from "./PlanningPage.js";

const baseProps = {
  sessions: planningSessions,
  createFields: planningCreateFields,
  labels: planningPageLabels,
};

const fullDay = new Intl.DateTimeFormat("es", { dateStyle: "full" });

/** Fecha de una sesión del fixture a partir de su título. */
function dateOf(title: string): Date {
  return planningSessions.find((session) => session.title === title)!.date as Date;
}

describe("PlanningPage", () => {
  it("muestra por defecto las sesiones de hoy en el detalle", () => {
    render(<PlanningPage {...baseProps} onCreateEvent={() => {}} />);

    expect(screen.getByRole("heading", { name: "Planificación" })).toBeDefined();
    expect(screen.getByText("Inglés B1 — Grupo A")).toBeDefined();
    expect(screen.getByText("Conversación C1")).toBeDefined();
    // Las de otros días no aparecen en el detalle.
    expect(screen.queryByText("Inglés A2 — Grupo B")).toBeNull();
  });

  it("seleccionar un día muestra sus sesiones y notifica la fecha", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<PlanningPage {...baseProps} onSelectDate={onSelectDate} onCreateEvent={() => {}} />);

    const target = dateOf("Inglés A2 — Grupo B");
    await user.click(screen.getByRole("button", { name: fullDay.format(target) }));

    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith(target);
    expect(screen.getByText("Inglés A2 — Grupo B")).toBeDefined();
    expect(screen.getByText(/17:00/)).toBeDefined();
    // Las sesiones de hoy ya no están en el detalle.
    expect(screen.queryByText("Conversación C1")).toBeNull();
  });

  it("crear una sesión notifica los valores del formulario", async () => {
    const user = userEvent.setup();
    const onCreateEvent = vi.fn();
    render(<PlanningPage {...baseProps} onCreateEvent={onCreateEvent} />);

    await user.click(screen.getByRole("button", { name: "Nueva sesión" }));
    await user.type(screen.getByRole("textbox", { name: "Título de la sesión" }), "Repaso intensivo");
    // El input de fecha se rellena por change: userEvent no maneja bien type=date.
    fireEvent.change(screen.getByLabelText(/Fecha/), { target: { value: "2026-04-02" } });
    await user.click(screen.getByRole("button", { name: "Guardar sesión" }));

    await waitFor(() => expect(onCreateEvent).toHaveBeenCalledTimes(1));
    const values = onCreateEvent.mock.calls[0]![0];
    expect(values.title).toBe("Repaso intensivo");
    expect(values.date).toBe("2026-04-02");
  });

  it("la acción de una sesión notifica el id de la sesión y el de la acción", async () => {
    const user = userEvent.setup();
    const onEventAction = vi.fn();
    render(
      <PlanningPage
        {...baseProps}
        sessionActions={planningSessionActions}
        onEventAction={onEventAction}
        onCreateEvent={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Acciones de Conversación C1" }));
    await user.click(screen.getByRole("menuitem", { name: "Cancelar sesión" }));

    expect(onEventAction).toHaveBeenCalledWith("ses-02", "cancel");
  });
});
