import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { SideNavBar } from "./SideNavBar.js";

const items = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox /> },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox />, active: true },
  { href: "/clases", label: "Clases", icon: <IconInbox /> },
];

describe("SideNavBar", () => {
  it("renderiza el landmark nav con su nombre accesible y los ítems como enlaces", () => {
    render(<SideNavBar items={items} ariaLabel="Navegación principal" />);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/inicio");
    expect(screen.getByRole("link", { name: "Clases" }).getAttribute("href")).toBe("/clases");
  });

  it("marca el ítem activo con aria-current=page", () => {
    render(<SideNavBar items={items} ariaLabel="Navegación principal" />);

    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Inicio" }).hasAttribute("aria-current")).toBe(false);
  });

  it("colapsada mantiene las etiquetas accesibles y refleja aria-expanded=false en el toggle", () => {
    render(
      <SideNavBar
        items={items}
        ariaLabel="Navegación principal"
        collapsed
        onToggleCollapse={() => {}}
        toggleLabel="Alternar navegación"
      />,
    );

    // La etiqueta sigue en el nombre accesible aunque esté oculta visualmente.
    expect(screen.getByRole("link", { name: "Inicio" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Alternar navegación" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("el botón de alternar notifica con onToggleCollapse", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();

    render(
      <SideNavBar
        items={items}
        ariaLabel="Navegación principal"
        onToggleCollapse={onToggleCollapse}
        toggleLabel="Alternar navegación"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Alternar navegación" }));

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("sin onToggleCollapse no hay botón de alternar", () => {
    render(<SideNavBar items={items} ariaLabel="Navegación principal" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("muestra los slots de cabecera y pie cuando se pasan", () => {
    render(
      <SideNavBar
        items={items}
        ariaLabel="Navegación principal"
        header={<span>Langopia</span>}
        footer={<span>Ana García</span>}
      />,
    );

    expect(screen.getByText("Langopia")).toBeDefined();
    expect(screen.getByText("Ana García")).toBeDefined();
  });
});
