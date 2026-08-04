import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorState } from "./ErrorState.js";

describe("ErrorState", () => {
  it("se anuncia como alerta con el título visible", () => {
    render(<ErrorState title="No se pudo cargar la lista" />);

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("No se pudo cargar la lista");
  });

  it("pinta descripción y acción de reintento cuando se pasan", () => {
    render(
      <ErrorState
        title="Error de red"
        description="traceId: abc-123"
        action={<button type="button">Reintentar</button>}
      />,
    );

    expect(screen.getByText("traceId: abc-123")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });

  it("omite descripción y acción si no se pasan", () => {
    render(<ErrorState title="Error" />);

    const alert = screen.getByRole("alert");

    expect(alert.querySelectorAll("p")).toHaveLength(1);
    expect(alert.querySelector("button")).toBeNull();
  });

  it("permite sustituir el icono por defecto", () => {
    render(<ErrorState title="Error" icon={<span data-testid="icono-propio" />} />);

    expect(screen.getByTestId("icono-propio")).toBeDefined();
  });
});
