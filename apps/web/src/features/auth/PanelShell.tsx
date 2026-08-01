import type { ReactElement, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsUpDown, Globe, LogOut } from "lucide-react";
import { useT } from "../../i18n/translate.js";
import { getSchoolSlug } from "../../lib/api-client.js";
import { getSchoolSettings } from "../onboarding/api.js";
import type { AuthUser } from "./api.js";
import { AppNav } from "./AppNav.js";
import { navLinksForRoles } from "./nav-links.js";
import { useMyRoles, useSignOut, useSwitchSchool } from "./session.js";
import styles from "./PanelShell.module.css";

export interface PanelShellProps {
  /** Usuaria ya autenticada (sesión en `"ready"`): nombre para la cabecera. */
  user: AuthUser;
  children: ReactNode;
}

/** Iniciales para los avatares (escuela y usuaria), máximo dos letras. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0]!.charAt(0) + parts[1]!.charAt(0) : name.slice(0, 2);
  return initials.toUpperCase();
}

/**
 * Marco visual del panel: la sidebar y la cabecera de la app anterior
 * (marca con logo en gradiente, tarjeta de escuela, nav vertical con
 * iconos, avatar de la usuaria), montado alrededor del contenido de cada
 * ruta. No decide nada de sesión — eso es de `ProtectedLayout`, que solo lo
 * pinta cuando el tenant ya está resuelto.
 *
 * La tarjeta de escuela muestra el nombre real cuando la membresía es de
 * dirección (`GET /schools/me` está restringido a `owner`/`admin` en la
 * API); para el resto de roles enseña el slug guardado al elegir escuela, y
 * si ni siquiera hay slug (una sola escuela, resolución automática), el
 * nombre de la usuaria. Nunca un dato inventado — el mismo criterio que
 * `SchoolSelector`.
 */
export function PanelShell({ user, children }: PanelShellProps): ReactElement {
  const t = useT();
  const roles = useMyRoles();
  const switchSchool = useSwitchSchool();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isDirection = roles?.some((role) => role === "owner" || role === "admin") === true;
  const schoolQuery = useQuery({
    queryKey: ["auth", "my-school-settings"],
    queryFn: getSchoolSettings,
    enabled: isDirection,
    staleTime: 60_000,
    retry: false,
  });

  const schoolName = schoolQuery.data?.name ?? getSchoolSlug() ?? user.name;
  const sectionTitle = navLinksForRoles(roles ?? []).find((link) =>
    link.to === "/" ? pathname === "/" : pathname.startsWith(link.to),
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Link to="/" className={styles.brandLink} aria-label={t("common.appName")}>
            <span className={styles.brandMark}>
              <Globe size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <span className={styles.brandName}>{t("common.appName")}</span>
          </Link>
        </div>

        <div className={styles.schoolCard}>
          <span className={styles.schoolAvatar} aria-hidden>
            {initialsOf(schoolName)}
          </span>
          <span className={styles.schoolInfo}>
            <span className={styles.schoolName}>{schoolName}</span>
            <span className={styles.schoolDetail}>{user.email}</span>
          </span>
          {/*
            Cambio de escuela (título de la Tarea 3): siempre disponible, no
            solo durante el alta — quien pertenece a varias necesita poder
            volver a elegir sin cerrar sesión. Vive en el marco, no en una
            pantalla concreta, para que ninguna ruta futura se quede sin él.
          */}
          <button
            type="button"
            className={styles.schoolSwitch}
            onClick={() => void switchSchool()}
            title={t("auth.switchSchool")}
            aria-label={t("auth.switchSchool")}
          >
            <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <AppNav />

        <div className={styles.sidebarFooter}>
          {/*
            Cerrar sesión vivía en el marcador temporal de `/` (Tarea 3);
            desde la Tarea 6 el hook probado (`useSignOut`) se pinta aquí, en
            el pie de la sidebar, disponible en cualquier pantalla del panel.
          */}
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            <span>{t("auth.signOut")}</span>
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          {sectionTitle ? (
            <h1 className={styles.sectionTitle}>{t(sectionTitle.labelKey)}</h1>
          ) : (
            <span />
          )}
          <span className={styles.userChip}>
            <span className={styles.userAvatar} aria-hidden>
              {initialsOf(user.name)}
            </span>
            <span className={styles.userName}>{user.name}</span>
          </span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
