/**
 * Relleno de `<dialog>` para jsdom (única fuente, Tarea 20 del panel).
 *
 * jsdom (la versión que usa `vitest` aquí) todavía no implementa
 * `HTMLDialogElement.showModal()`/`.close()`, que es justo lo que usa la
 * molécula `Dialog` para abrir y cerrar el `<dialog>` nativo. Sin este
 * relleno, cualquier prueba que monte un `Dialog` falla con
 * «dialog.showModal is not a function» antes de comprobar nada — no es un
 * fallo del componente, es un hueco del entorno de pruebas.
 *
 * Lo importan los `setup` de Vitest del paquete (`src/test/setup.ts`) y de la
 * app (`apps/app/src/test/setup.ts`, vía la exportación
 * `@langopia/ui/test/dialog-polyfill`): antes vivía duplicado por feature en
 * la app (`billing` y `calendar`, con el comentario «no es sitio de esta
 * tarea tocar un fichero compartido»), y la Tarea 20 lo centraliza aquí, al
 * lado del componente que lo necesita.
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
