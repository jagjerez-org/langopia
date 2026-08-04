import type { ReactElement } from "react";
import { useT } from "./i18n/translate.js";

/**
 * Raíz de la SPA (Tarea 1: esqueleto).
 *
 * Deliberadamente mínimo: el enrutador (TanStack Router) y la sesión llegan
 * en las tareas 2-3 del panel. Este componente solo demuestra que Vite +
 * React están montados y que la aplicación arranca; no es una pantalla real,
 * pero su único texto («Langopia») pasa igualmente por `useT()` — sin
 * `I18nProvider` por encima, `useT()` cae a es-ES por defecto (Tarea 5), así
 * que no hace falta montar nada más para que esto compile y funcione.
 */
export function App(): ReactElement {
  const t = useT();
  return (
    <main>
      <h1>{t("common.appName")}</h1>
    </main>
  );
}

export default App;
