import { useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, EmptyState } from "@langopia/ui";
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
    <main className="flex min-h-svh items-center justify-center bg-canvas p-6">
      <section className="flex w-[min(26rem,100%)] flex-col gap-4 rounded-[var(--ink-radius-lg)] border border-border bg-surface p-6 shadow-[var(--ink-shadow-md)]">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t("auth.schoolPickerTitle")}</h1>
          <p className="text-sm text-muted">{t("auth.schoolPickerDescription")}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {schools.map((slug) => (
            // Cada escuela ocupa todo el ancho de la tarjeta: es una elección
            // entre pocas opciones, no una acción más de un formulario. El
            // `Button` del DS pinta un `<button>` como raíz, así que el hijo
            // directo del `<li>` ES el botón.
            <li key={slug} className="[&>*]:w-full">
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
      </section>
    </main>
  );
}
