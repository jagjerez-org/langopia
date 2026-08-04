/**
 * Configuración global de Vitest para @langopia/ui.
 *
 * Con `globals: false` no hay hooks ni matchers implícitos; limpiamos el DOM
 * explícitamente después de cada prueba para que los tests sean independientes.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

/**
 * jsdom (la versión que usa `vitest` aquí) todavía no implementa
 * `HTMLDialogElement.showModal()`/`.close()`, que es justo lo que usa la
 * molécula `Dialog` para abrir y cerrar el `<dialog>` nativo. Sin este
 * relleno, cualquier prueba que monte un `Dialog` falla con
 * «dialog.showModal is not a function» antes de comprobar nada — no es un
 * fallo del componente, es un hueco del entorno de pruebas.
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
