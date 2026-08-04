import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ItemSideNavBar } from "./ItemSideNavBar.js";
import { IconInbox } from "../Icons/Icons.js";

function renderItem(props: Partial<Parameters<typeof ItemSideNavBar>[0]> = {}) {
  return render(
    <ItemSideNavBar icon={<IconInbox />} label="Alumnos" href="/alumnos" {...props} />,
  );
}

describe("ItemSideNavBar", () => {
  it("renderiza un enlace con icono y etiqueta", () => {
    const { container } = renderItem();

    const link = screen.getByRole("link", { name: "Alumnos" });
    expect(link.getAttribute("href")).toBe("/alumnos");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("sin active no lleva aria-current ni data-active", () => {
    renderItem();

    const link = screen.getByRole("link", { name: "Alumnos" });
    expect(link.getAttribute("aria-current")).toBeNull();
    expect(link.getAttribute("data-active")).toBeNull();
  });

  it('active marca el enlace con aria-current="page"', () => {
    renderItem({ active: true });

    const link = screen.getByRole("link", { name: "Alumnos" });
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.getAttribute("data-active")).toBe("true");
  });

  it("colapsado mantiene la etiqueta accesible y la ofrece como title", () => {
    renderItem({ collapsed: true });

    const link = screen.getByRole("link", { name: "Alumnos" });
    expect(link.getAttribute("data-collapsed")).toBe("true");
    expect(link.getAttribute("title")).toBe("Alumnos");

    const label = link.querySelector("span:last-child")!;
    expect(label.className).toContain("sr-only");
  });

  it("sin colapsar no lleva title", () => {
    renderItem();

    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("title")).toBeNull();
  });

  it("reenvía la ref al elemento anchor", () => {
    const ref = createRef<HTMLAnchorElement>();

    render(
      <ItemSideNavBar ref={ref} icon={<IconInbox />} label="Alumnos" href="/alumnos" />,
    );

    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });
});
