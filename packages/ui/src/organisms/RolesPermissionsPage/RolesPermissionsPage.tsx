import { useState } from "react";
import type { ReactElement } from "react";
import { Toggle } from "../../atoms/Toggle/Toggle.js";
import { ActionBar } from "../../molecules/ActionBar/ActionBar.js";
import { CrudForm } from "../../molecules/CrudForm/CrudForm.js";
import type { CrudFormValues } from "../../molecules/CrudForm/CrudForm.js";
import { ListRow } from "../../molecules/ListRow/ListRow.js";
import { Section } from "../../molecules/Section/Section.js";

/** Permiso individual del catálogo: clave estable y texto ya traducido. */
export interface PermissionItem {
  key: string;
  label: string;
}

/** Grupo de permisos que se muestra como una `Section` colapsable. */
export interface PermissionCategory {
  id: string;
  label: string;
  permissions: PermissionItem[];
}

export interface RoleDefinition {
  /** Clave estable del rol. */
  id: string;
  name: string;
  description?: string;
  /** Claves del catálogo activas para este rol. */
  enabledPermissions: string[];
}

export interface RolesPermissionsPageLabels {
  /** Título de la página. */
  title: string;
  /** Nombre accesible de la lista de roles. */
  rolesListLabel: string;
  /** Título del panel de permisos del rol seleccionado. */
  permissionsTitle: string;
  /** Texto cuando no hay ningún rol seleccionado. */
  emptySelectionLabel: string;
  /** Botón que muestra el formulario de alta. */
  createRoleLabel: string;
  /** Título de la sección con el formulario de alta. */
  createRoleTitle: string;
  roleNameLabel: string;
  roleDescriptionLabel: string;
  /** Botón de enviar el formulario de alta. */
  submitRoleLabel: string;
  cancelLabel: string;
  /** Ítem del menú de la fila para borrar el rol. */
  deleteRoleLabel: string;
  /** Nombre accesible del menú de acciones de cada rol. */
  roleActionsLabel: (roleName: string) => string;
}

export interface RolesPermissionsPageProps {
  roles: RoleDefinition[];
  /** Catálogo de permisos agrupados por categoría. */
  permissionCatalog: PermissionCategory[];
  /** Textos de la interfaz, ya traducidos. */
  labels: RolesPermissionsPageLabels;
  /** Notifica cada cambio de permiso con el rol, la clave y el nuevo estado. */
  onTogglePermission: (roleId: string, permissionKey: string, enabled: boolean) => void;
  /** Recibe los valores del formulario de alta (`name`, `description`). */
  onCreateRole: (values: CrudFormValues) => void;
  /** Si se pasa, cada rol muestra la acción de borrado en su menú. */
  onDeleteRole?: (roleId: string) => void;
}

const wrapperStyles = "flex w-full flex-col gap-4";
const titleStyles =
  "m-0 font-sans text-[length:var(--ink-text-xl)] leading-[var(--ink-leading-xl)] font-bold text-text";
const columnsStyles = "grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]";
const panelStyles = "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4";
const panelTitleStyles =
  "m-0 font-sans text-[length:var(--ink-text-md)] leading-[var(--ink-leading-md)] font-semibold text-text";
const roleListStyles = "m-0 flex list-none flex-col gap-0.5 p-0";
const permissionsStyles = "flex flex-col gap-3";
const toggleListStyles = "m-0 flex list-none flex-col gap-2 p-0";
const emptyStyles =
  "m-0 font-sans text-[length:var(--ink-text-sm)] leading-[var(--ink-leading-sm)] text-muted";

/**
 * Página de gestión de roles y permisos: lista de roles a la izquierda
 * (`ListRow` con estado activo y menú de acciones) y, a la derecha, los
 * permisos del rol seleccionado agrupados por categoría (`Section`
 * colapsable con un `Toggle` por permiso). El alta de roles es un `CrudForm`
 * inline que se despliega desde la barra de acciones.
 *
 * Sin API: el estado de los permisos se inicializa desde `roles` y se
 * mantiene dentro del componente (como los valores de facturación de
 * `CheckoutPage`); cada cambio se notifica por `onTogglePermission`.
 */
export function RolesPermissionsPage({
  roles,
  permissionCatalog,
  labels,
  onTogglePermission,
  onCreateRole,
  onDeleteRole,
}: RolesPermissionsPageProps): ReactElement {
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(roles[0]?.id);
  const [isCreating, setIsCreating] = useState(false);
  // Estado interno de permisos por rol: solo se leen las props en el montaje.
  const [enabledByRole, setEnabledByRole] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((role) => [role.id, role.enabledPermissions])),
  );

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const togglePermission = (roleId: string, permissionKey: string, enabled: boolean) => {
    setEnabledByRole((current) => {
      const currentKeys = current[roleId] ?? [];
      const nextKeys = enabled
        ? [...currentKeys, permissionKey]
        : currentKeys.filter((key) => key !== permissionKey);
      return { ...current, [roleId]: nextKeys };
    });
    onTogglePermission(roleId, permissionKey, enabled);
  };

  const createRole = (values: CrudFormValues) => {
    onCreateRole(values);
    setIsCreating(false);
  };

  return (
    <div className={wrapperStyles}>
      <h1 className={titleStyles}>{labels.title}</h1>
      <ActionBar
        actions={[
          {
            label: labels.createRoleLabel,
            variant: "primary",
            onClick: () => setIsCreating(true),
          },
        ]}
      />
      {isCreating && (
        <Section title={labels.createRoleTitle}>
          <CrudForm
            fields={[
              { name: "name", label: labels.roleNameLabel, required: true },
              { name: "description", label: labels.roleDescriptionLabel },
            ]}
            onSubmit={createRole}
            onCancel={() => setIsCreating(false)}
            submitLabel={labels.submitRoleLabel}
            cancelLabel={labels.cancelLabel}
          />
        </Section>
      )}
      <div className={columnsStyles}>
        <section aria-label={labels.rolesListLabel} className={panelStyles}>
          <ul className={roleListStyles}>
            {roles.map((role) => (
              <li key={role.id}>
                <ListRow
                  title={role.name}
                  subtitle={role.description}
                  active={role.id === selectedRoleId}
                  onClick={() => setSelectedRoleId(role.id)}
                  actions={
                    onDeleteRole !== undefined
                      ? [
                          {
                            label: labels.deleteRoleLabel,
                            onClick: () => onDeleteRole(role.id),
                          },
                        ]
                      : undefined
                  }
                  actionsLabel={labels.roleActionsLabel(role.name)}
                />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label={labels.permissionsTitle} className={panelStyles}>
          <h2 className={panelTitleStyles}>
            {selectedRole ? `${labels.permissionsTitle} — ${selectedRole.name}` : labels.permissionsTitle}
          </h2>
          {selectedRole === undefined ? (
            <p className={emptyStyles}>{labels.emptySelectionLabel}</p>
          ) : (
            <div className={permissionsStyles}>
              {permissionCatalog.map((category) => (
                <Section key={category.id} title={category.label}>
                  <ul className={toggleListStyles}>
                    {category.permissions.map((permission) => (
                      <li key={permission.key}>
                        <Toggle
                          checked={
                            enabledByRole[selectedRole.id]?.includes(permission.key) ?? false
                          }
                          onChange={(enabled) =>
                            togglePermission(selectedRole.id, permission.key, enabled)
                          }
                          label={permission.label}
                        />
                      </li>
                    ))}
                  </ul>
                </Section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
