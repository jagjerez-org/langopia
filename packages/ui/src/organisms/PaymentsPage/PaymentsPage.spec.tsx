import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  managementPayments,
  paymentActions,
  paymentsPageLabels,
  paymentSummaryKpis,
} from "../../fixtures/management.js";
import { PaymentsPage } from "./PaymentsPage.js";

const baseProps = {
  summary: paymentSummaryKpis,
  payments: managementPayments,
  actions: paymentActions,
  labels: paymentsPageLabels,
};

describe("PaymentsPage", () => {
  it("renderiza el resumen y la lista de facturas con su estado", () => {
    render(<PaymentsPage {...baseProps} onAction={() => {}} />);

    expect(screen.getByRole("heading", { name: "Pagos y facturas" })).toBeDefined();
    expect(screen.getByText("12.480 €")).toBeDefined();
    expect(screen.getByText("Factura 2026-041 — Curso B1")).toBeDefined();
    expect(screen.getAllByText("Pagado")).not.toHaveLength(0);
  });

  it("filtra las facturas por estado", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage {...baseProps} onAction={() => {}} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "pending");

    expect(screen.getByText("Factura 2026-042 — Curso C1")).toBeDefined();
    expect(screen.getByText("Factura 2026-044 — Curso A2")).toBeDefined();
    // Las facturas pagadas o vencidas desaparecen del listado.
    expect(screen.queryByText("Factura 2026-041 — Curso B1")).toBeNull();
    expect(screen.queryByText("Factura 2026-038 — Material del curso")).toBeNull();
  });

  it("la acción de una fila notifica el id del pago y el de la acción", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<PaymentsPage {...baseProps} onAction={onAction} />);

    // El disparador del menú se nombra con el concepto de la fila.
    await user.click(screen.getByRole("button", { name: "Factura 2026-038 — Material del curso" }));
    await user.click(screen.getByRole("menuitem", { name: "Reembolsar" }));

    expect(onAction).toHaveBeenCalledWith("pay-003", "refund");
  });

  it("pagina la lista cuando hay pageSize", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage {...baseProps} pageSize={3} onAction={() => {}} />);

    expect(screen.getByText("1 de 3")).toBeDefined();
    expect(screen.queryByText("Factura 2026-043 — Matrícula")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("2 de 3")).toBeDefined();
    expect(screen.getByText("Factura 2026-043 — Matrícula")).toBeDefined();
  });
});
