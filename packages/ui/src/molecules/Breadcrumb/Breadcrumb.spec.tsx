import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "./Breadcrumb.js";

const items = [
  { label: "Inicio", href: "/" },
  { label: "Alumnos", href: "/alumnos" },
  { label: "Ana García" },
];

describe("Breadcrumb", () => {
  it("renderiza el landmark nav con lista ordenada y los niveles como enlaces", () => {
    render(<Breadcrumb items={items} ariaLabel="Migas de pan" />);

    const nav = screen.getByRole("navigation", { name: "Migas de pan" });
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Alumnos" }).getAttribute("href")).toBe("/alumnos");
  });

  it("el último nivel es la página actual: sin enlace y con aria-current=page", () => {
    render(<Breadcrumb items={items} ariaLabel="Migas de pan" />);

    expect(screen.queryByRole("link", { name: "Ana García" })).toBeNull();
    const current = screen.getByText("Ana García");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("usa el separador por defecto \"/\" y admite uno personalizado", () => {
    const { rerender } = render(<Breadcrumb items={items} ariaLabel="Migas de pan" />);

    const nav = screen.getByRole("navigation", { name: "Migas de pan" });
    expect(nav.textContent).toBe("Inicio/Alumnos/Ana García");

    rerender(<Breadcrumb items={items} ariaLabel="Migas de pan" separator="›" />);
    expect(nav.textContent).toBe("Inicio›Alumnos›Ana García");
  });

  it("con maxItems colapsa los niveles intermedios tras un marcador", () => {
    const many = [
      { label: "Inicio", href: "/" },
      { label: "Academia", href: "/academia" },
      { label: "Cursos", href: "/cursos" },
      { label: "Alumnos", href: "/alumnos" },
      { label: "Ana García" },
    ];

    render(<Breadcrumb items={many} ariaLabel="Migas de pan" maxItems={3} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Inicio", "Alumnos"]);
    expect(screen.queryByRole("link", { name: "Academia" })).toBeNull();
    expect(screen.getByText("…")).toBeDefined();
    // La página actual sigue siendo la última.
    expect(screen.getByText("Ana García").getAttribute("aria-current")).toBe("page");
  });

  it("respeta el texto del marcador de colapso", () => {
    const many = [
      { label: "Inicio", href: "/" },
      { label: "Academia", href: "/academia" },
      { label: "Alumnos", href: "/alumnos" },
      { label: "Ana García" },
    ];

    render(
      <Breadcrumb items={many} ariaLabel="Migas de pan" maxItems={2} collapsedLabel="más" />,
    );

    expect(screen.getByText("más")).toBeDefined();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
