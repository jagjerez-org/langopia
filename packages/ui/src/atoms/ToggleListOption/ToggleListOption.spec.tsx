import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { ToggleListOption } from "./ToggleListOption.js";

describe("ToggleListOption", () => {
  it("renderiza un switch con la etiqueta de la opción", () => {
    render(<ToggleListOption label="Columna: correo" checked={false} onChange={() => {}} />);

    const toggle = screen.getByRole("switch", { name: "Columna: correo" });

    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("refleja el estado en la fila con data-checked", () => {
    const { container } = render(
      <ToggleListOption label="Columna: teléfono" checked onChange={() => {}} />,
    );

    const row = container.firstElementChild;

    expect(row?.getAttribute("data-checked")).not.toBeNull();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("muestra el hint bajo la etiqueta", () => {
    render(
      <ToggleListOption label="Columna: nivel" hint="Solo en vista detallada" checked={false} onChange={() => {}} />,
    );

    expect(screen.getByText("Solo en vista detallada")).toBeDefined();
  });

  it("notifica el estado invertido al pulsar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ToggleListOption label="Columna: alta" checked={false} onChange={onChange} />);

    await user.click(screen.getByRole("switch", { name: "Columna: alta" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled no notifica cambios", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ToggleListOption label="Columna: notas" checked={false} onChange={onChange} disabled />);

    await user.click(screen.getByRole("switch", { name: "Columna: notas" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reenvía la ref al switch interno", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<ToggleListOption label="Con ref" checked={false} onChange={() => {}} ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
