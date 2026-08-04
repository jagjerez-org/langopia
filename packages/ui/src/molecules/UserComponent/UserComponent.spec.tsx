import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserComponent } from "./UserComponent.js";

describe("UserComponent", () => {
  it("muestra el nombre y el rol", () => {
    render(<UserComponent name="María López" role="Administradora" />);

    expect(screen.getByText("María López")).toBeDefined();
    expect(screen.getByText("Administradora")).toBeDefined();
  });

  it("usa el email como texto secundario cuando no hay rol", () => {
    render(<UserComponent name="María López" email="maria@langopia.com" />);

    expect(screen.getByText("maria@langopia.com")).toBeDefined();
  });

  it("el rol tiene prioridad sobre el email como texto secundario", () => {
    render(<UserComponent name="María López" role="Administradora" email="maria@langopia.com" />);

    expect(screen.getByText("Administradora")).toBeDefined();
    expect(screen.queryByText("maria@langopia.com")).toBeNull();
  });

  it("el avatar es decorativo: queda fuera del árbol de accesibilidad", () => {
    const { container } = render(<UserComponent name="María López" />);

    const avatarWrapper = container.querySelector('[aria-hidden="true"]');
    expect(avatarWrapper).not.toBeNull();
    // Sin acceso por rol: el avatar no aporta un nombre duplicado.
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("sin avatarUrl cae a las iniciales del nombre", () => {
    render(<UserComponent name="María López" />);

    expect(screen.getByText("ML")).toBeDefined();
  });

  it("con avatarUrl muestra la imagen dentro del avatar", () => {
    const { container } = render(
      <UserComponent name="María López" avatarUrl="https://example.com/maria.png" />,
    );

    const img = container.querySelector('[aria-hidden="true"] img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/maria.png");
  });

  it("en modo collapsed el nombre se oculta visualmente pero sigue accesible", () => {
    render(<UserComponent name="María López" role="Administradora" collapsed />);

    const hiddenName = screen.getByText("María López");
    expect(hiddenName.className).toContain("sr-only");
    // El rol no se renderiza en modo compacto.
    expect(screen.queryByText("Administradora")).toBeNull();
  });

  it("con href es un enlace cuyo nombre accesible es exactamente el nombre", () => {
    render(<UserComponent name="María López" role="Administradora" href="/perfil" />);

    // El nombre accesible concatena nombre y rol sin espacio (los spans no
    // llevan whitespace entre ellos); lo importante es que no hay duplicado.
    const link = screen.getByRole("link", { name: "María LópezAdministradora" });
    expect(link.getAttribute("href")).toBe("/perfil");
  });

  it("con onClick es un botón que notifica el clic", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<UserComponent name="María López" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "María López" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("collapsed y clickable: el nombre accesible del enlace es exactamente el nombre", () => {
    render(<UserComponent name="María López" href="/perfil" collapsed />);

    // Sin duplicado: el avatar va con aria-hidden y solo queda el sr-only.
    expect(screen.getByRole("link", { name: "María López" })).toBeDefined();
  });

  it("sin href ni onClick no es interactivo", () => {
    render(<UserComponent name="María López" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
