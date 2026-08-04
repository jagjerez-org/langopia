import { IconInbox } from "../atoms/Icons/Icons.js";
import type { ThemeToggleLabels } from "../atoms/ThemeToggle/ThemeToggle.js";
import type { BottomPageItem } from "../molecules/BottomPage/BottomPage.js";
import type { BreadcrumbItem } from "../molecules/Breadcrumb/Breadcrumb.js";
import type { SideNavBarItem } from "../molecules/SideNavBar/SideNavBar.js";
import type { UserComponentProps } from "../molecules/UserComponent/UserComponent.js";
import type { ShellUserMenuItem } from "../organisms/Shell/Shell.js";

/**
 * Datos ficticios compartidos por las stories y specs del organismo `Shell`.
 * Sin datos reales del dominio: personas y secciones de relleno.
 */

export const shellNavItems: SideNavBarItem[] = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox />, active: true },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox /> },
  { href: "/clases", label: "Clases", icon: <IconInbox /> },
  { href: "/informes", label: "Informes", icon: <IconInbox /> },
];

export const shellBottomNavItems: BottomPageItem[] = [
  { href: "/inicio", label: "Inicio", icon: <IconInbox />, active: true },
  { href: "/alumnos", label: "Alumnos", icon: <IconInbox /> },
  { href: "/perfil", label: "Perfil", icon: <IconInbox /> },
];

export const shellBreadcrumbItems: BreadcrumbItem[] = [
  { label: "Alumnos", href: "/alumnos" },
  { label: "Ana García" },
];

export const shellUser: UserComponentProps = {
  name: "María López",
  role: "Administradora",
};

export const shellUserMenuItems: ShellUserMenuItem[] = [
  { label: "Mi perfil", href: "/perfil" },
  { label: "Cerrar sesión", onClick: () => {} },
];

export const shellThemeLabels: ThemeToggleLabels = {
  light: "Claro",
  dark: "Oscuro",
};
