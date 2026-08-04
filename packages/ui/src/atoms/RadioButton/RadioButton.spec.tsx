import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { RadioButton } from "./RadioButton.js";

describe("RadioButton", () => {
  it("renderiza un radio con etiqueta asociada", () => {
    render(<RadioButton name="nivel" value="b1" label="Intermedio (B1)" />);

    const radio = screen.getByRole("radio", { name: "Intermedio (B1)" });

    expect(radio.getAttribute("type")).toBe("radio");
    expect((radio as HTMLInputElement).checked).toBe(false);
  });

  it("se selecciona al hacer click y notifica onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RadioButton name="nivel" value="a2" label="Elemental (A2)" onChange={onChange} />);

    const radio = screen.getByRole("radio", { name: "Elemental (A2)" });
    await user.click(radio);

    expect((radio as HTMLInputElement).checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("en un grupo con el mismo name solo queda uno marcado", async () => {
    const user = userEvent.setup();

    render(
      <>
        <RadioButton name="plan" value="inicial" label="Inicial" defaultChecked />
        <RadioButton name="plan" value="escala" label="Escala" />
      </>,
    );

    const inicial = screen.getByRole("radio", { name: "Inicial" }) as HTMLInputElement;
    const escala = screen.getByRole("radio", { name: "Escala" }) as HTMLInputElement;

    await user.click(escala);

    expect(inicial.checked).toBe(false);
    expect(escala.checked).toBe(true);
  });

  it("muestra el hint y lo enlaza con aria-describedby", () => {
    render(<RadioButton name="x" value="1" label="Opción" hint="Recomendada" />);

    const radio = screen.getByRole("radio", { name: "Opción" });
    const hintId = radio.getAttribute("aria-describedby");

    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId!)?.textContent).toBe("Recomendada");
  });

  it("disabled impide la selección", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RadioButton name="y" value="1" label="Bloqueada" disabled onChange={onChange} />);

    const radio = screen.getByRole("radio", { name: "Bloqueada" });
    await user.click(radio);

    expect((radio as HTMLInputElement).checked).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reenvía la ref al elemento input", () => {
    const ref = createRef<HTMLInputElement>();

    render(<RadioButton name="z" value="1" label="Con ref" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
