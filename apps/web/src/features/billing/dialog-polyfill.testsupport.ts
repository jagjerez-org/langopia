/**
 * jsdom (la versión que usa `vitest` aquí) todavía no implementa
 * `HTMLDialogElement.showModal()`/`.close()`, que es justo lo que
 * `ui/Dialog.tsx` (Tarea 4) usa para abrir y cerrar el `<dialog>` nativo. Sin
 * este relleno, cualquier prueba que monte `IssueInvoiceDialog` u
 * `OpenRefundDialog` falla con «dialog.showModal is not a function» antes de
 * llegar a comprobar nada.
 *
 * Copia exacta de `features/calendar/dialog-polyfill.testsupport.ts` (Tarea
 * 9): vive en el propio feature, no en `test/setup.ts`, por el mismo motivo
 * que allí — no es sitio de esta tarea tocar un fichero compartido por un
 * hueco que solo afecta a quien abre un `<dialog>` en sus pruebas.
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
