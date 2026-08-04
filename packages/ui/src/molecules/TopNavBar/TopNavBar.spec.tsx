import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserAvatar } from "../../atoms/UserAvatar/UserAvatar.js";
import { TopNavBar } from "./TopNavBar.js";

describe("TopNavBar", () => {
  it("renderiza el título como encabezado de nivel 1", () => {
    render(<TopNavBar title="Alumnos" />);

    expect(screen.getByRole("heading", { level: 1, name: "Alumnos" })).toBeDefined();
  });

  it("muestra el slot de migas de pan cuando se pasa", () => {
    render(
      <TopNavBar
        title="Ana García"
        breadcrumb={
          <nav aria-label="Migas de pan">
            <a href="/alumnos">Alumnos</a>
          </nav>
        }
      />,
    );

    expect(screen.getByRole("navigation", { name: "Migas de pan" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("href")).toBe("/alumnos");
  });

  it("muestra las acciones de la derecha cuando se pasan", () => {
    render(<TopNavBar title="Alumnos" actions={<UserAvatar name="Ana García" size="sm" />} />);

    expect(screen.getByRole("img", { name: "Ana García" })).toBeDefined();
  });

  it("sin acciones ni migas solo muestra el título", () => {
    render(<TopNavBar title="Alumnos" />);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
