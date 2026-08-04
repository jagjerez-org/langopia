import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("se anuncia como región de estado con el título visible", () => {
    render(<EmptyState title="No hay alumnos" />);

    const status = screen.getByRole("status");

    expect(status.textContent).toContain("No hay alumnos");
  });

  it("pinta descripción y acción cuando se pasan", () => {
    render(
      <EmptyState
        title="Sin resultados"
        description="Prueba con otros filtros"
        action={<button type="button">Añadir alumno</button>}
      />,
    );

    expect(screen.getByText("Prueba con otros filtros")).toBeDefined();
    expect(screen.getByRole("button", { name: "Añadir alumno" })).toBeDefined();
  });

  it("omite descripción y acción si no se pasan", () => {
    render(<EmptyState title="Vacío" />);

    const status = screen.getByRole("status");

    expect(status.querySelectorAll("p")).toHaveLength(1);
    expect(status.querySelector("button")).toBeNull();
  });

  it("permite sustituir el icono por defecto", () => {
    render(<EmptyState title="Vacío" icon={<span data-testid="icono-propio" />} />);

    expect(screen.getByTestId("icono-propio")).toBeDefined();
  });
});
