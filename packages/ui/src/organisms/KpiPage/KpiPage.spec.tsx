import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  kpiDetailItems,
  kpiPageLabels,
  kpiRangeOptions,
  managementKpis,
} from "../../fixtures/management.js";
import { KpiPage } from "./KpiPage.js";

const baseProps = {
  kpis: managementKpis,
  ranges: kpiRangeOptions,
  labels: kpiPageLabels,
};

describe("KpiPage", () => {
  it("renderiza todos los KPIs con sus valores", () => {
    render(<KpiPage {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Métricas" })).toBeDefined();
    // Cada KpiChart titula su tarjeta con un heading de nivel 3.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(managementKpis.length);
    expect(screen.getByText("18.640 €")).toBeDefined();
    expect(screen.getByText("Alumnado activo")).toBeDefined();
  });

  it("el cambio de rango notifica con el valor de la opción", async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(<KpiPage {...baseProps} onRangeChange={onRangeChange} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Periodo" }), "90");

    expect(onRangeChange).toHaveBeenCalledWith("90");
    // En modo no controlado la página actualiza su propia selección.
    expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveProperty("value", "90");
  });

  it("muestra la sección de detalle cuando hay filas", () => {
    render(<KpiPage {...baseProps} detail={kpiDetailItems} />);

    expect(screen.getByRole("button", { name: "Detalle por curso" })).toBeDefined();
    expect(screen.getByText("Inglés B1 — Mañanas")).toBeDefined();
  });

  it("sin detalle no renderiza la sección", () => {
    render(<KpiPage {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Detalle por curso" })).toBeNull();
  });
});
