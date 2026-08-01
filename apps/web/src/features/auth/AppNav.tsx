import type { ReactElement } from "react";
import { Link } from "@tanstack/react-router";
import { useT } from "../../i18n/translate.js";
import { navLinksForRoles } from "./nav-links.js";
import { useMyRoles } from "./session.js";

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
    <nav aria-label={t("nav.label")}>
      <ul className="flex gap-4">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to}>{t(link.labelKey)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
