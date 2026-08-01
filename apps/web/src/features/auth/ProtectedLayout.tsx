import { useEffect } from "react";
import type { ReactElement } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useT } from "../../i18n/translate.js";
import { ImpersonationBanner } from "../impersonation/ImpersonationBanner.js";
import { PanelShell } from "./PanelShell.js";
import { SchoolSelector } from "./SchoolSelector.js";
import { useSession } from "./session.js";

/**
 * Puerta del panel (Tarea 3): todas las rutas protegidas cuelgan de esta
 * ruta pasillo (sin `path` propio, ver `router.tsx`). Decide, a partir de
 * `useSession()`:
 *
 *   - sin sesión, o correo sin verificar → redirige a `/entrar`.
 *   - varias escuelas usables → el selector, no el contenido.
 *   - tenant resuelto → el contenido de verdad, con el aviso de
 *     impersonación (Tarea 17) montado por encima: solo tiene sentido una
 *     vez hay escuela, y es lo primero que debe ver quien está siendo
 *     impersonado, en cualquier pantalla del panel.
 */
export function ProtectedLayout(): ReactElement | null {
  const t = useT();
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session.status === "anonymous" || session.status === "unverified") {
      navigate({ to: "/entrar", replace: true });
    }
  }, [session.status, navigate]);

  if (session.status === "loading") {
    return (
      <main aria-busy="true">
        <p role="status">{t("auth.checkingSession")}</p>
      </main>
    );
  }

  if (session.status === "anonymous" || session.status === "unverified") {
    // La redirección ya está en marcha (efecto de arriba); nada que pintar
    // mientras el enrutador cambia de ruta.
    return null;
  }

  if (session.status === "needs-school") {
    return <SchoolSelector schools={session.schools} />;
  }

  return (
    <>
      <ImpersonationBanner />
      {/*
        El marco visual (sidebar + cabecera) es de `PanelShell`; el aviso de
        impersonación (Tarea 17) se monta por encima de TODO el marco: solo
        tiene sentido una vez hay escuela, y es lo primero que debe ver
        quien está siendo impersonado, en cualquier pantalla del panel.
        «Cambiar de escuela» y «cerrar sesión» viven dentro de la sidebar
        del marco — mismos hooks probados (`useSwitchSchool`, `useSignOut`),
        solo cambia el sitio donde se pintan.
      */}
      <PanelShell user={session.user}>
        <Outlet />
      </PanelShell>
    </>
  );
}
