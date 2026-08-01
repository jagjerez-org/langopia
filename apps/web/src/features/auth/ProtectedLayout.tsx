import { useEffect } from "react";
import type { ReactElement } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { Button } from "../../ui/index.js";
import { useT } from "../../i18n/translate.js";
import { ImpersonationBanner } from "../impersonation/ImpersonationBanner.js";
import { AppNav } from "./AppNav.js";
import { SchoolSelector } from "./SchoolSelector.js";
import { useSession, useSignOut, useSwitchSchool } from "./session.js";

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
  const switchSchool = useSwitchSchool();
  const signOut = useSignOut();

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
      <AppNav />
      {/*
        Cambio de escuela (título de la Tarea 3): siempre disponible, no solo
        durante el alta — quien pertenece a varias necesita poder volver a
        elegir sin cerrar sesión. Vive en el marco, no en una pantalla
        concreta, para que ninguna ruta futura se quede sin él.

        Cerrar sesión vivía en el marcador temporal de `/`
        (`HomePlaceholder`, Tarea 3) que la Tarea 6 sustituye por el panel de
        dirección de verdad: sin moverlo aquí, ninguna pantalla podría cerrar
        sesión. El hook (`useSignOut`) ya estaba probado desde la Tarea 3;
        esto solo le da un sitio permanente para pintarse.
      */}
      <Button variant="ghost" size="sm" onClick={() => void switchSchool()}>
        {t("auth.switchSchool")}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void signOut()}>
        {t("auth.signOut")}
      </Button>
      <Outlet />
    </>
  );
}
