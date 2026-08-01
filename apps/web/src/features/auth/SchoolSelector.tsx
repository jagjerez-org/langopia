import { useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, EmptyState } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import { useChooseSchool } from "./session.js";

export interface SchoolSelectorProps {
  /** Slugs de las escuelas usables, tal como los devuelve `resolveTenant` (API). */
  schools: string[];
}

/**
 * Selector de escuela (Tarea 3, Paso 5): preferencia de interfaz, no un
 * permiso — elegir aquí solo fija la cabecera `x-school-slug` para las
 * peticiones siguientes, entre las escuelas que el servidor YA ofrece como
 * usables. No concede nada que la sesión no tuviera ya.
 *
 * Sin nombres de escuela todavía: `tenant_resolution_failed` solo trae
 * `slugs` en sus `params` (`SessionTenantGuard`), no un nombre para mostrar.
 * Mostrar el slug tal cual es lo más honesto sin inventar un dato que la API
 * no da hoy — una mejora legítima para cuando exista un listado con nombre,
 * pero fuera del alcance de esta tarea.
 */
export function SchoolSelector({ schools }: SchoolSelectorProps): ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const chooseSchool = useChooseSchool();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  if (schools.length === 0) {
    // Correo verificado, sin ninguna membresía en ninguna escuela: quien
    // acaba de crear su cuenta (Tarea 12, `/registro`) llega aquí en cuanto
    // `ProtectedLayout` resuelve la sesión. Sin esta acción, era un callejón
    // sin salida — nada volvía a llevar a `/registro`.
    return (
      <EmptyState
        title={t("auth.noSchools")}
        action={<Button onClick={() => navigate({ to: "/registro" })}>{t("onboarding.register.title")}</Button>}
      />
    );
  }

  const handleChoose = async (slug: string): Promise<void> => {
    setPendingSlug(slug);
    try {
      await chooseSchool(slug);
    } catch (error) {
      // Vuelve al selector en vez de reventar: si la sesión de verdad ya no
      // vale (`missing_tenant`), `api-client.ts` ya se encarga de llevar a
      // `/entrar`; cualquier otro fallo deja la lista lista para reintentar
      // en vez de una pantalla rota a medio elegir.
      console.error("no se pudo confirmar la escuela elegida", { slug, error });
    } finally {
      // Si la elección funcionó, `useSession()` deja de reportar
      // "needs-school" y este componente se desmonta; si no, vuelve a
      // pintarse la lista, lista para reintentar.
      setPendingSlug(null);
    }
  };

  return (
    <main>
      <h1>{t("auth.schoolPickerTitle")}</h1>
      <p>{t("auth.schoolPickerDescription")}</p>
      <ul>
        {schools.map((slug) => (
          <li key={slug}>
            <Button
              onClick={() => void handleChoose(slug)}
              isLoading={pendingSlug === slug}
              disabled={pendingSlug !== null && pendingSlug !== slug}
            >
              {slug} — {t("auth.chooseSchool")}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
