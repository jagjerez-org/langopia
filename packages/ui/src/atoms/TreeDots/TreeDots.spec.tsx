import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { TreeDots } from "./TreeDots.js";

function renderTreeDots(props: Partial<Parameters<typeof TreeDots>[0]> = {}) {
  return render(
    <TreeDots triggerLabel="Más acciones de la reserva" {...props}>
      <button type="button">Duplicar</button>
    </TreeDots>,
  );
}

describe("TreeDots", () => {
  it("renderiza el disparador cerrado, con nombre accesible y aria-haspopup", () => {
    renderTreeDots();

    const trigger = screen.getByRole("button", { name: "Más acciones de la reserva" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("abre el popup al pulsar y lo vuelve a cerrar con otra pulsación", async () => {
    const user = userEvent.setup();
    renderTreeDots();

    const trigger = screen.getByRole("button", { name: "Más acciones de la reserva" });

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Duplicar" })).not.toBeNull();

    // aria-controls apunta al popup abierto.
    const menu = screen.getByRole("menu");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.getAttribute("id"));

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Escape cierra el popup y devuelve el foco al disparador", async () => {
    const user = userEvent.setup();
    renderTreeDots();

    const trigger = screen.getByRole("button", { name: "Más acciones de la reserva" });
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("un clic fuera del componente cierra el popup", async () => {
    const user = userEvent.setup();
    renderTreeDots();

    await user.click(screen.getByRole("button", { name: "Más acciones de la reserva" }));
    expect(screen.queryByRole("menu")).not.toBeNull();

    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("un clic dentro del popup no lo cierra", async () => {
    const user = userEvent.setup();
    const onClickItem = vi.fn();
    render(
      <TreeDots triggerLabel="Más acciones">
        <button type="button" onClick={onClickItem}>
          Duplicar
        </button>
      </TreeDots>,
    );

    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    await user.click(screen.getByRole("button", { name: "Duplicar" }));

    expect(onClickItem).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  it("alinea el popup según la prop align", async () => {
    const user = userEvent.setup();
    renderTreeDots({ align: "start" });

    await user.click(screen.getByRole("button", { name: "Más acciones de la reserva" }));

    expect(screen.getByRole("menu").getAttribute("data-align")).toBe("start");
  });

  it("disabled bloquea el disparador y no abre el popup", async () => {
    const user = userEvent.setup();
    renderTreeDots({ disabled: true });

    const trigger = screen.getByRole("button", { name: "Más acciones de la reserva" });
    expect(trigger.hasAttribute("disabled")).toBe(true);

    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reenvía la ref al contenedor", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <TreeDots ref={ref} triggerLabel="Más acciones">
        <span>Contenido</span>
      </TreeDots>,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
