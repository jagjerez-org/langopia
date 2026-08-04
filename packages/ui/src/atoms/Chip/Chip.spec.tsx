import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Chip } from "./Chip.js";

describe("Chip", () => {
  it("renderiza el texto y la variante neutral por defecto", () => {
    render(<Chip>En curso</Chip>);

    const chip = screen.getByText("En curso").closest("span")!.parentElement!;

    expect(chip.getAttribute("data-variant")).toBe("neutral");
  });

  it("expone data-variant según la prop", () => {
    render(<Chip variant="critical">Riesgo de baja</Chip>);

    const chip = screen.getByText("Riesgo de baja").closest("span")!.parentElement!;

    expect(chip.getAttribute("data-variant")).toBe("critical");
  });

  it("las variantes semánticas llevan icono además de color", () => {
    const { container, rerender } = render(<Chip variant="success">Al día</Chip>);
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<Chip variant="warning">Pendiente</Chip>);
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<Chip variant="critical">Impagado</Chip>);
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<Chip variant="accent">Seleccionado</Chip>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("sin onRemove no hay botón de quitar", () => {
    render(<Chip>Fijo</Chip>);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("con onRemove muestra el botón de quitar con su nombre accesible", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <Chip onRemove={onRemove} removeLabel="Quitar nivel B2">
        Nivel B2
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: "Quitar nivel B2" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disabled bloquea el botón de quitar", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <Chip onRemove={onRemove} removeLabel="Quitar" disabled>
        Bloqueado
      </Chip>,
    );

    const button = screen.getByRole("button", { name: "Quitar" });
    expect(button.hasAttribute("disabled")).toBe(true);

    await user.click(button);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("reenvía la ref al elemento span", () => {
    const ref = createRef<HTMLSpanElement>();

    render(<Chip ref={ref}>Con ref</Chip>);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
