import { StrictMode } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { I18nProvider, useT } from "./i18n/translate.js";
import { DEFAULT_LOCALE, isLocale } from "./i18n/locale.js";
import { router } from "./router.js";
import { ToastProvider } from "./ui/index.js";
import "./index.css";

/**
 * Idioma activo del panel (Tarea 3): todavía no hay una escuela ni una
 * preferencia de persona que lo fijen server-side (esa fuente llegará con un
 * selector de idioma propio; `resolveLocale`, en la API, ya deja sitio para
 * ella), así que hoy la única fuente es el navegador — la misma que ya
 * mandaba `api-client.ts` como `Accept-Language` a través de
 * `document.documentElement.lang`. Se fija aquí ANTES de montar nada para
 * que las dos cosas —lo que se pide al servidor y lo que se pinta— usen
 * siempre el mismo valor.
 */
const browserLocale = navigator.language;
const locale = isLocale(document.documentElement.lang)
  ? document.documentElement.lang
  : isLocale(browserLocale)
    ? browserLocale
    : DEFAULT_LOCALE;
document.documentElement.lang = locale;

const queryClient = new QueryClient();

/**
 * `ToastProvider` (sistema de diseño, Tarea 4) necesita sus dos etiquetas
 * accesibles ya traducidas (`label` de la región, `closeLabel` del botón de
 * cerrar cada aviso): por eso vive DENTRO de `I18nProvider`, en un
 * componente propio que puede llamar a `useT()` — `main.tsx` no es un
 * componente y no puede.
 */
function AppShell(): ReactElement {
  const t = useT();
  return (
    <ToastProvider label={t("common.toastRegionLabel")} closeLabel={t("common.toastCloseLabel")}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ToastProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el nodo #root en index.html");

createRoot(root).render(
  <StrictMode>
    <I18nProvider locale={locale}>
      <AppShell />
    </I18nProvider>
  </StrictMode>,
);
