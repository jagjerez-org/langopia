/**
 * Configuración global de Vitest (referenciada desde `vite.config.ts`).
 *
 * `@testing-library/react` limpia el DOM entre pruebas por sí solo desde su
 * versión con auto-registro de `afterEach`, pero como `globals: false` aquí
 * (nada de matchers ni hooks implícitos), lo hacemos explícito para que cada
 * prueba empiece con un documento limpio sin que el autor tenga que
 * acordarse.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
// Relleno de `<dialog>` (`showModal`/`close`, ausentes en jsdom) para las
// pruebas que montan un `Dialog` del DS — única fuente en el paquete.
import "@langopia/ui/test/dialog-polyfill";

afterEach(() => {
  cleanup();
});
