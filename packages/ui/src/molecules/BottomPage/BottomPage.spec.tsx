import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IconInbox } from "../../atoms/Icons/Icons.js";
import { BottomPage } from "./BottomPage.js";

const items = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox />, active: true },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox /> },
  { href: "/perfil", label: "Perfil", icon: <IconInbox /> },
];

describe("BottomPage", () => {
  it("renderiza el landmark nav con su nombre accesible y las acciones como enlaces", () => {
    render(<BottomPage items={items} ariaLabel="Acciones de página" />);

    expect(screen.getByRole("navigation", { name: "Acciones de página" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/inicio");
    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("href")).toBe("/alumnos");
    expect(screen.getByRole("link", { name: "Perfil" }).getAttribute("href")).toBe("/perfil");
  });

  it("marca la acción activa con aria-current=page", () => {
    render(<BottomPage items={items} ariaLabel="Acciones de página" />);

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Alumnos" }).hasAttribute("aria-current")).toBe(false);
  });

  it("funciona con una sola acción", () => {
    render(
      <BottomPage
        items={[{ href: "/guardar", label: "Guardar", icon: <IconInbox /> }]}
        ariaLabel="Acciones de página"
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
