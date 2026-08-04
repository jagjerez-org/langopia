import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconCheck } from "../../atoms/Icons/Icons.js";
import { ActionBar } from "./ActionBar.js";

describe("ActionBar", () => {
  it("renderiza las acciones como botones y notifica los clics", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ActionBar
        actions={[
          { label: "Cancelar", onClick: () => {} },
          { label: "Guardar", onClick: onSave, variant: "primary" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("las acciones con href son enlaces", () => {
    render(<ActionBar actions={[{ label: "Volver al listado", href: "/alumnos" }]} />);

    expect(screen.getByRole("link", { name: "Volver al listado" }).getAttribute("href")).toBe(
      "/alumnos",
    );
  });

  it("muestra el título como encabezado cuando se pasa", () => {
    render(<ActionBar title="Ficha de alumno" actions={[{ label: "Editar", onClick: () => {} }]} />);

    expect(screen.getByRole("heading", { name: "Ficha de alumno" })).toBeDefined();
  });

  it("respeta disabled e isLoading", () => {
    render(
      <ActionBar
        actions={[
          { label: "Eliminar", onClick: () => {}, variant: "danger", disabled: true },
          { label: "Guardar", onClick: () => {}, variant: "primary", isLoading: true },
        ]}
      />,
    );

    expect((screen.getByRole("button", { name: "Eliminar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const saving = screen.getByRole("button", { name: "Guardar" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect(saving.getAttribute("aria-busy")).toBe("true");
  });

  it("las acciones con icono conservan el nombre accesible del texto", () => {
    render(
      <ActionBar actions={[{ label: "Aprobar", onClick: () => {}, icon: <IconCheck /> }]} />,
    );

    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDefined();
  });
});
