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
    <div className="flex min-h-svh bg-canvas">
      {/* Pegajosa a la altura del viewport: el contenido desliza, el marco no.
          En pantallas estrechas (< 64rem) la sidebar se convierte en una barra
          de iconos: mejor eso que ocultar la navegación detrás de un menú
          hamburguesa que todavía no existe. El botón de cambiar de escuela
          queda sin sitio y se retira SOLO en este modo — es un panel de
          escritorio primero, y la acción sigue disponible al cerrar sesión y
          volver a entrar. */}
      <aside className="sticky top-0 flex h-svh w-64 shrink-0 flex-col border-r border-border bg-surface max-lg:w-[4.5rem]">
        <div className="border-b border-border px-5 py-4 max-lg:px-2 max-lg:text-center">
          <Link to="/" className="inline-flex items-center gap-3 rounded-[var(--ink-radius-md)] no-underline" aria-label={t("common.appName")}>
            {/* El gradiente de marca vive aquí (y en el avatar de escuela):
                elementos sin texto, donde el contraste de AA no aplica. */}
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--ink-radius-md)] bg-[image:var(--ink-brand-gradient)] text-white shadow-[var(--ink-shadow-sm)]">
              <Globe size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-[length:var(--ink-text-xl)] font-bold tracking-[-0.02em] max-lg:hidden">{t("common.appName")}</span>
          </Link>
        </div>

        <div className="mx-3 mb-1 mt-3 flex items-center gap-3 rounded-[var(--ink-radius-lg)] border border-border bg-surface px-3 py-2 max-lg:justify-center max-lg:p-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ink-radius-md)] bg-[image:var(--ink-brand-gradient)] text-xs font-bold uppercase text-white" aria-hidden>
            {initialsOf(schoolName)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col max-lg:hidden">
            <span className="truncate text-sm font-semibold">{schoolName}</span>
            <span className="truncate text-xs text-[color:var(--ink-text-tertiary)]">{user.email}</span>
          </span>
          {/*
            Cambio de escuela (título de la Tarea 3): siempre disponible, no
            solo durante el alta — quien pertenece a varias necesita poder
            volver a elegir sin cerrar sesión. Vive en el marco, no en una
            pantalla concreta, para que ninguna ruta futura se quede sin él.
          */}
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer rounded-[var(--ink-radius-sm)] p-1 text-[color:var(--ink-text-tertiary)] transition-[background-color,color] duration-fast ease-[var(--ink-ease-standard)] hover:bg-surface-secondary hover:text-text max-lg:hidden"
            onClick={() => void switchSchool()}
            title={t("auth.switchSchool")}
            aria-label={t("auth.switchSchool")}
          >
            <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <AppNav />

        <div className="border-t border-border p-2">
          {/*
            Cerrar sesión vivía en el marcador temporal de `/` (Tarea 3);
            desde la Tarea 6 el hook probado (`useSignOut`) se pinta aquí, en
            el pie de la sidebar, disponible en cualquier pantalla del panel.
            En la barra de iconos (< 64rem) la etiqueta se oculta SOLO a la
            vista (`sr-only`): sigue siendo el nombre accesible del botón.
          */}
          <button
            type="button"
            className="flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-[var(--ink-radius-md)] px-3 py-1 text-sm font-medium text-muted transition-[background-color,color] duration-fast ease-[var(--ink-ease-standard)] hover:bg-critical-bg hover:text-critical max-lg:justify-center max-lg:px-0"
            onClick={() => void signOut()}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            <span className="max-lg:sr-only">{t("auth.signOut")}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera pegajosa: el título de sección y el avatar siguen a la
            vista al deslizar pantallas largas (calendario, listados). */}
        <header className="sticky top-0 z-[var(--ink-z-dropdown)] flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-8">
          {sectionTitle ? (
            <h1 className="text-base font-semibold tracking-[-0.01em]">{t(sectionTitle.labelKey)}</h1>
          ) : (
            <span />
          )}
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--ink-brand-gradient)] text-xs font-semibold uppercase text-white" aria-hidden>
              {initialsOf(user.name)}
            </span>
            <span className="truncate text-sm font-medium max-lg:hidden">{user.name}</span>
          </span>
        </header>
        {/* Sin max-width: las pantallas que la quieren ya la fijan ellas
            mismas (DashboardScreen, 72rem); el calendario y el editor web
            usan el ancho completo. */}
        <div className="min-w-0 flex-1 px-8 py-6">{children}</div>
      </div>
    </div>
  );
}
