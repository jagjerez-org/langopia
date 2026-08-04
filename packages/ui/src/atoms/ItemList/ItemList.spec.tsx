import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { ItemList } from "./ItemList.js";
import { IconChevronRight, IconInbox } from "../Icons/Icons.js";

describe("ItemList", () => {
  it("sin href ni onClick es una fila estática sin rol interactivo", () => {
    const { container } = render(<ItemList>Grupo B2 mañanas</ItemList>);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild!.tagName).toBe("DIV");
  });

  it("con href renderiza un enlace", () => {
    render(<ItemList href="/grupos/b2">Grupo B2 mañanas</ItemList>);

    const link = screen.getByRole("link", { name: "Grupo B2 mañanas" });
    expect(link.getAttribute("href")).toBe("/grupos/b2");
    expect(link.getAttribute("data-clickable")).toBe("true");
  });

  it('un enlace activo lleva aria-current="page"', () => {
    render(
      <ItemList href="/grupos/b2" active>
        Grupo B2 mañanas
      </ItemList>,
    );

    const link = screen.getByRole("link", { name: "Grupo B2 mañanas" });
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.getAttribute("data-active")).toBe("true");
  });

  it("con onClick renderiza un botón que notifica al pulsar", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ItemList onClick={onClick}>Grupo B2 mañanas</ItemList>);

    await user.click(screen.getByRole("button", { name: "Grupo B2 mañanas" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("un botón activo lleva aria-pressed", () => {
    render(
      <ItemList onClick={() => {}} active>
        Grupo B2 mañanas
      </ItemList>,
    );

    expect(screen.getByRole("button", { name: "Grupo B2 mañanas" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("disabled bloquea el botón", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ItemList onClick={onClick} disabled>
        Grupo B2 mañanas
      </ItemList>,
    );

    const button = screen.getByRole("button", { name: "Grupo B2 mañanas" });
    expect(button.hasAttribute("disabled")).toBe(true);

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renderiza leading y accessory a los lados del contenido", () => {
    const { container } = render(
      <ItemList leading={<IconInbox />} accessory={<IconChevronRight />}>
        Grupo B2 mañanas
      </ItemList>,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(screen.getByText("Grupo B2 mañanas")).not.toBeNull();
  });

  it("reenvía la ref al elemento renderizado", () => {
    const ref = createRef<HTMLAnchorElement>();

    render(
      <ItemList ref={ref} href="/grupos/b2">
        Grupo B2 mañanas
      </ItemList>,
    );

    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });
});
