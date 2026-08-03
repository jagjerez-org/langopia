import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { Toggle } from "./Toggle.js";

describe("Toggle", () => {
  it("renderiza role=switch con aria-checked=false y etiqueta visible", () => {
    render(<Toggle checked={false} onChange={() => {}} label="Notificaciones" />);

    const toggle = screen.getByRole("switch", { name: "Notificaciones" });

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.hasAttribute("data-checked")).toBe(false);
  });

  it("aria-checked=true y data-checked cuando está activo", () => {
    render(<Toggle checked onChange={() => {}} label="Notificaciones" />);

    const toggle = screen.getByRole("switch", { name: "Notificaciones" });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.getAttribute("data-checked")).not.toBeNull();
  });

  it("al hacer click notifica el estado invertido", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked={false} onChange={onChange} label="Sonido" />);

    await user.click(screen.getByRole("switch", { name: "Sonido" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("desde activo notifica false", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked onChange={onChange} label="Sonido" />);

    await user.click(screen.getByRole("switch", { name: "Sonido" }));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("se acciona con teclado (Espacio)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked={false} onChange={onChange} label="Teclado" />);

    screen.getByRole("switch", { name: "Teclado" }).focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled no notifica cambios", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Toggle checked={false} onChange={onChange} label="Bloqueado" disabled />);

    await user.click(screen.getByRole("switch", { name: "Bloqueado" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("funciona como componente controlado", async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [checked, setChecked] = useState(false);
      return <Toggle checked={checked} onChange={setChecked} label="Controlado" />;
    }

    render(<Wrapper />);

    const toggle = screen.getByRole("switch", { name: "Controlado" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await user.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("reenvía la ref al elemento button", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Toggle checked={false} onChange={() => {}} label="Con ref" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
