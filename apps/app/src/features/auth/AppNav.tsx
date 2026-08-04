import type { ReactElement } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCheck,
  Circle,
  ClipboardCheck,
  FileText,
  Globe,
  GraduationCap,
  LayoutDashboard,
  PanelsTopLeft,
  Receipt,
  RotateCcw,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "../../i18n/translate.js";
import { navLinksForRoles } from "./nav-links.js";
import { useMyRoles } from "./session.js";

/* Base de cada enlace: icono + etiqueta, inactivo en gris con hover suave.
   A juego con la sidebar estrecha de `PanelShell` (< 64rem): solo el icono,
   centrado — la etiqueta se oculta con `sr-only`, NO con `display: none`,
   porque es el único nombre accesible del enlace. */
const LINK_BASE =
  "flex min-h-9 items-center gap-3 rounded-[var(--ink-radius-md)] px-3 py-1 text-sm font-medium no-underline transition-[background-color,color] duration-fast ease-[var(--ink-ease-standard)] max-lg:justify-center max-lg:px-0";
const LINK_INACTIVE = "text-muted hover:bg-surface-secondary hover:text-text";
/* Activo con acento sólido, no el gradiente de marca: con texto blanco
   encima da 6.09:1 (AA) en claro y 4.55:1 en oscuro; el stop azul del
   gradiente se quedaba en 4.16:1, por debajo de AA para texto. */
const LINK_ACTIVE =
  "bg-accent text-text-inverse shadow-[var(--ink-shadow-sm),0_2px_10px_color-mix(in_oklch,var(--ink-accent-default)_30%,transparent)] hover:bg-accent-hover hover:text-text-inverse";

/**
 * Icono de cada ruta del menú (lucide, la librería de iconos de la app
 * anterior). Es un mapa ruta → icono y no una propiedad más de `NavLink`
 * a propósito: `nav-links.ts` es la fuente de verdad de QUÉ enlaces ve cada
 * rol (con su spec), y no se toca — el icono es puramente decorativo, la
 * etiqueta traducida sigue siendo el portador del significado.
 */
const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/analitica": BarChart3,
  "/candidatos": UserPlus,
  "/transcripciones": FileText,
  "/web/editor": PanelsTopLeft,
  "/web/dominios": Globe,
  "/alumnos": GraduationCap,
  "/calendario": CalendarDays,
  "/contenido": Sparkles,
  "/correcciones": CheckCheck,
  "/mi/clases": CalendarDays,
  "/mi/facturas": Receipt,
  "/mi/asistencia": ClipboardCheck,
  "/mi/progreso": TrendingUp,
  "/mi/ejercicios": BookOpen,
  "/mi/repaso": RotateCcw,
};

/**
 * Navegación del panel, distinta según el rol de la sesión (Tarea 11, Paso
 * 1). Componente propio —no un `<nav>` suelto dentro de `ProtectedLayout`—
 * por el mismo motivo que `ImpersonationBanner`: solo tiene sentido montarlo
 * una vez la sesión está en `"ready"` (tenant ya resuelto), así que hace su
 * propia consulta (`useMyRoles`) en vez de forzar a `ProtectedLayout` a
 * encadenar un `enabled` manual.
 *
 * Sin roles todavía resueltos (la consulta en curso), no pinta ningún
 * enlace: mejor un menú vacío un instante que uno que ofrezca una ruta a la
 * que el rol real no tendría acceso.
 */
export function AppNav(): ReactElement {
  const t = useT();
  const roles = useMyRoles();
  const links = navLinksForRoles(roles ?? []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    /* La nav es la única zona de la sidebar que crece y desliza: con muchas
       entradas (dirección ve diez) el pie con «cerrar sesión» queda siempre
       visible. */
    <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto p-2">
      <ul className="flex flex-col gap-0.5">
        {links.map((link) => {
          const Icon = ROUTE_ICONS[link.to] ?? Circle;
          // La raíz ("/") casa por prefijo con TODAS las rutas del panel, así
          // que es la única que pide coincidencia exacta — la misma regla que
          // el `activeOptions` del `Link` y que el título de `PanelShell`.
          const isActive = link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
          return (
            <li key={link.to}>
              <Link
                to={link.to}
                activeOptions={{ exact: link.to === "/" }}
                className={`${LINK_BASE} ${isActive ? LINK_ACTIVE : LINK_INACTIVE}`}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                <span className="max-lg:sr-only">{t(link.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
