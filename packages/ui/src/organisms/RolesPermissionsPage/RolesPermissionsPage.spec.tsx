import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  managementPermissionCatalog,
  managementRoles,
  rolesPermissionsLabels,
} from "../../fixtures/management.js";
import { RolesPermissionsPage } from "./RolesPermissionsPage.js";

const baseProps = {
  roles: managementRoles,
  permissionCatalog: managementPermissionCatalog,
  labels: rolesPermissionsLabels,
};

describe("RolesPermissionsPage", () => {
  it("seleccionar un rol muestra sus permisos", async () => {
    const user = userEvent.setup();
    render(
      <RolesPermissionsPage {...baseProps} onTogglePermission={() => {}} onCreateRole={() => {}} />,
    );

    // Por defecto se selecciona el primer rol (Administración): lo puede todo.
    expect(
      screen.getByRole("switch", { name: "Reembolsar pagos" }).getAttribute("aria-checked"),
    ).toBe("true");

    // La fila del rol es un botón cuyo nombre accesible concatena título y descripción.
    await user.click(screen.getByRole("button", { name: /^Profesorado/ }));

    // El profesorado no puede reembolsar, pero sí editar sesiones.
    expect(
      screen.getByRole("switch", { name: "Reembolsar pagos" }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(
      screen.getByRole("switch", { name: "Editar sesiones" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("heading", { name: "Permisos — Profesorado" }),
    ).toBeDefined();
  });

  it("el toggle de un permiso notifica rol, clave y nuevo estado", async () => {
    const user = userEvent.setup();
    const onTogglePermission = vi.fn();
    render(
      <RolesPermissionsPage
        {...baseProps}
        onTogglePermission={onTogglePermission}
        onCreateRole={() => {}}
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Emitir facturas" });
    await user.click(toggle);

    expect(onTogglePermission).toHaveBeenCalledWith("role-admin", "billing.create", false);
    // El estado interno se actualiza aunque quien llama no haga nada.
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("crear rol envía los valores del formulario y cierra el alta", async () => {
    const user = userEvent.setup();
    const onCreateRole = vi.fn();
    render(
      <RolesPermissionsPage
        {...baseProps}
        onTogglePermission={() => {}}
        onCreateRole={onCreateRole}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Nuevo rol" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del rol" }), "Coordinación");
    await user.click(screen.getByRole("button", { name: "Guardar rol" }));

    await waitFor(() => expect(onCreateRole).toHaveBeenCalledTimes(1));
    expect(onCreateRole.mock.calls[0]![0]).toEqual({ name: "Coordinación", description: "" });
    // El formulario se cierra tras enviar.
    expect(screen.queryByRole("textbox", { name: "Nombre del rol" })).toBeNull();
  });

  it("la acción de borrado notifica el id del rol", async () => {
    const user = userEvent.setup();
    const onDeleteRole = vi.fn();
    render(
      <RolesPermissionsPage
        {...baseProps}
        onTogglePermission={() => {}}
        onCreateRole={() => {}}
        onDeleteRole={onDeleteRole}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Acciones de Recepción" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar rol" }));

    expect(onDeleteRole).toHaveBeenCalledWith("role-frontdesk");
  });
});
