import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  shellBottomNavItems,
  shellBreadcrumbItems,
  shellNavItems,
  shellThemeLabels,
  shellUser,
  shellUserMenuItems,
} from "../../fixtures/shell.js";
import { Shell } from "./Shell.js";
import type { ShellBaseProps } from "./Shell.js";

const baseProps: ShellBaseProps = {
  navItems: shellNavItems,
  navAriaLabel: "Navegación principal",
  title: "Alumnos",
  user: shellUser,
  children: <p>Contenido de la página</p>,
};

const themedProps = {
  theme: "light" as const,
  onThemeChange: () => {},
  themeLabels: shellThemeLabels,
};

const userMenuProps = {
  userMenuItems: shellUserMenuItems,
  userMenuLabel: "Menú de usuario",
};

describe("Shell", () => {
  it("renderiza los landmarks principales: navegación, cabecera y contenido", () => {
    render(<Shell {...baseProps} />);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
  });

  it("renderiza los ítems de navegación y notifica el destino al pulsar", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<Shell {...baseProps} onNavigate={onNavigate} />);

    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("href")).toBe("/alumnos");

    await user.click(screen.getByRole("link", { name: "Clases" }));
    expect(onNavigate).toHaveBeenCalledWith("/clases");
  });

  it("sin onNavigate los enlaces de navegación siguen funcionando", () => {
    render(<Shell {...baseProps} />);

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/inicio");
  });

  it("el área de contenido recibe los children dentro del landmark main", () => {
    render(<Shell {...baseProps} />);

    expect(within(screen.getByRole("main")).getByText("Contenido de la página")).toBeDefined();
  });

  it("muestra el título en la barra superior", () => {
    render(<Shell {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Alumnos" })).toBeDefined();
  });

  it("renderiza ThemeToggle y UserComponent en la barra superior", () => {
    render(<Shell {...baseProps} {...themedProps} />);

    const topBar = within(screen.getByRole("banner"));
    expect(topBar.getByRole("button", { name: "Claro" })).toBeDefined();
    expect(topBar.getByText("María López")).toBeDefined();
  });

  it("el interruptor de tema notifica el cambio", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();

    render(<Shell {...baseProps} {...themedProps} onThemeChange={onThemeChange} />);
    await user.click(screen.getByRole("button", { name: "Claro" }));

    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("sin props de tema no se renderiza el interruptor", () => {
    render(<Shell {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Claro" })).toBeNull();
  });

  it("el TreeDots abre el menú de usuario y sus acciones notifican", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <Shell
        {...baseProps}
        userMenuLabel="Menú de usuario"
        userMenuItems={[{ label: "Cerrar sesión", onClick: onLogout }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("el menú de usuario enlaza entradas con href", async () => {
    const user = userEvent.setup();

    render(<Shell {...baseProps} {...userMenuProps} />);
    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));

    expect(screen.getByRole("link", { name: "Mi perfil" }).getAttribute("href")).toBe("/perfil");
  });

  it("sin userMenuItems no hay disparador de menú de usuario", () => {
    render(<Shell {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Menú de usuario" })).toBeNull();
  });

  it("renderiza la barra inferior cuando se pasan items", () => {
    render(
      <Shell
        {...baseProps}
        bottomNavItems={shellBottomNavItems}
        bottomNavAriaLabel="Navegación inferior"
      />,
    );

    const bottomNav = screen.getByRole("navigation", { name: "Navegación inferior" });
    expect(within(bottomNav).getByRole("link", { name: "Perfil" })).toBeDefined();
  });

  it("sin bottomNavItems no hay barra inferior", () => {
    render(<Shell {...baseProps} />);

    expect(screen.queryByRole("navigation", { name: "Navegación inferior" })).toBeNull();
  });

  it("renderiza las migas de pan cuando se pasan", () => {
    render(
      <Shell
        {...baseProps}
        breadcrumb={shellBreadcrumbItems}
        breadcrumbAriaLabel="Migas de pan"
      />,
    );

    expect(screen.getByRole("navigation", { name: "Migas de pan" })).toBeDefined();
  });

  it("colapsada refleja el estado en el botón de alternar", () => {
    render(
      <Shell
        {...baseProps}
        collapsed
        onToggleCollapse={() => {}}
        toggleCollapseLabel="Alternar navegación"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Alternar navegación" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("muestra las acciones extra del slot topBarActions", () => {
    render(<Shell {...baseProps} topBarActions={<button type="button">Ayuda</button>} />);

    expect(
      within(screen.getByRole("banner")).getByRole("button", { name: "Ayuda" }),
    ).toBeDefined();
  });
});
