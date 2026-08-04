import type { ReactElement } from "react";
import { Link } from "@tanstack/react-router";
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
import styles from "./AppNav.module.css";

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

  return (
    <nav aria-label={t("nav.label")} className={styles.nav}>
      <ul className={styles.list}>
        {links.map((link) => {
          const Icon = ROUTE_ICONS[link.to] ?? Circle;
          return (
            <li key={link.to}>
              {/*
                El estado activo lo pinta el propio `Link` con
                `data-status="active"` (ver AppNav.module.css). La raíz ("/")
                casa por prefijo con TODAS las rutas del panel, así que es la
                única que pide coincidencia exacta.
              */}
              <Link
                to={link.to}
                activeOptions={{ exact: link.to === "/" }}
                className={styles.link}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />
                <span>{t(link.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
