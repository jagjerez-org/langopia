import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiChart } from "./KpiChart.js";
import { kpiDown, kpiUp } from "../../fixtures/kpis.js";

describe("KpiChart", () => {
  it("renderiza título, valor, delta y la gráfica con nombre accesible (fixture)", () => {
    render(<KpiChart {...kpiUp} />);

    expect(screen.getByText("Visitas semanales")).toBeDefined();
    expect(screen.getByText("12.480")).toBeDefined();
    expect(screen.getByText("+8,2 %")).toBeDefined();
    expect(
      screen.getByRole("img", { name: "Evolución de las visitas semanales, tendencia ascendente" }),
    ).toBeDefined();
  });

  it("la tendencia ascendente lleva color semántico de éxito y lectura accesible", () => {
    render(<KpiChart {...kpiUp} />);

    const trend = screen.getByText("+8,2 %");
    expect(trend.getAttribute("data-trend")).toBe("up");
    expect(screen.getByText("sube un 8,2 %")).toBeDefined();
  });

  it("la tendencia descendente se marca como down", () => {
    render(<KpiChart {...kpiDown} />);

    expect(screen.getByText("-12,5 %").getAttribute("data-trend")).toBe("down");
  });

  it("normaliza la serie al viewBox en una polyline", () => {
    const { container } = render(<KpiChart title="Visitas" value="10" data={[0, 5, 10]} />);

    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    // El primer punto toca el mínimo y el último el máximo del rango vertical.
    expect(polyline!.getAttribute("points")).toBe("0,37 50,20 100,3");
  });

  it("con la serie vacía muestra el estado vacío y no dibuja la gráfica", () => {
    const { container } = render(<KpiChart title="Visitas" value="0" data={[]} emptyLabel="Sin datos" />);

    expect(screen.getByText("Sin datos")).toBeDefined();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("la tabla accesible de puntos es opcional y usa formatPoint", () => {
    const { rerender } = render(<KpiChart {...kpiUp} />);
    expect(screen.queryByRole("table")).toBeNull();

    rerender(<KpiChart {...kpiUp} showDataTable formatPoint={(point) => `${point} visitas`} />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("42 visitas")).toBeDefined();
  });
});
