import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./Panel.js";

describe("Panel", () => {
  it("pinta el cuerpo siempre, sin cabecera si no hay título ni acciones", () => {
    render(<Panel>Contenido del panel</Panel>);

    expect(screen.getByText("Contenido del panel")).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("pinta título y acciones en la cabecera", () => {
    render(
      <Panel title="Alumnos" actions={<button type="button">Añadir</button>}>
        Tabla de alumnos
      </Panel>,
    );

    expect(screen.getByRole("heading", { name: "Alumnos" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Añadir" })).toBeDefined();
  });

  it("pinta el pie cuando se pasa", () => {
    render(<Panel footer={<p>Pie del panel</p>}>Cuerpo</Panel>);

    expect(screen.getByText("Pie del panel")).toBeDefined();
  });

  it("acepta atributos HTML del contenedor (p. ej. aria-label)", () => {
    render(<Panel aria-label="Zona de métricas">Métricas</Panel>);

    expect(screen.getByLabelText("Zona de métricas")).toBeDefined();
  });
});
