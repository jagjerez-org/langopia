import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Input } from "./Input.js";

describe("Input", () => {
  it("asocia la etiqueta con el control", () => {
    render(<Input label="Correo electrónico" />);

    const input = screen.getByLabelText("Correo electrónico");

    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("respeta un id explícito y genera uno si falta", () => {
    render(<Input label="Con id" id="campo-correo" />);

    expect(screen.getByLabelText("Con id").getAttribute("id")).toBe("campo-correo");
  });

  it("marca required con aria-required y muestra el asterisco oculto a lectores", () => {
    render(<Input label="Nombre" required />);

    const input = screen.getByLabelText(/Nombre/);

    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.hasAttribute("required")).toBe(true);
  });

  it("muestra el hint y lo enlaza con aria-describedby", () => {
    render(<Input label="Usuario" hint="Solo letras y números" />);

    const input = screen.getByLabelText("Usuario");
    const hintId = input.getAttribute("aria-describedby");

    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId!)?.textContent).toBe("Solo letras y números");
  });

  it("el error sustituye al hint, fija aria-invalid y role=alert", () => {
    render(<Input label="Correo" hint="Ayuda" error="Formato no válido" />);

    const input = screen.getByLabelText(/Correo/);

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Formato no válido");
    expect(screen.queryByText("Ayuda")).toBeNull();
  });

  it("isLoading fija aria-busy y muestra el spinner", () => {
    render(<Input label="Disponibilidad" isLoading />);

    expect(screen.getByLabelText("Disponibilidad").getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector(".ink-spin")).not.toBeNull();
  });

  it("renderiza adornos leading y trailing", () => {
    render(
      <Input
        label="Importe"
        leadingAdornment={<span data-testid="lead" />}
        trailingAdornment={<span data-testid="trail" />}
      />,
    );

    expect(screen.getByTestId("lead")).toBeDefined();
    expect(screen.getByTestId("trail")).toBeDefined();
  });

  it("acepta escritura y propaga el valor", async () => {
    const user = userEvent.setup();

    render(<Input label="Ciudad" defaultValue="" />);

    const input = screen.getByLabelText("Ciudad");
    await user.type(input, "Vigo");

    expect((input as HTMLInputElement).value).toBe("Vigo");
  });

  it("reenvía la ref al elemento input", () => {
    const ref = createRef<HTMLInputElement>();

    render(<Input label="Con ref" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
