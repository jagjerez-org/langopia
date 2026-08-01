/**
 * Estado de una factura. Mismos valores que `invoice_status` en Postgres
 * (`enums-match-db.spec.ts` lo comprueba).
 *
 * Esta tarea solo hace transicionar `open` → `paid` (`issue()`/`markPaid()`).
 * `draft`, `past_due`, `void` y `uncollectible` existen porque el esquema los
 * contempla —y el seed los usa—, pero ningún método del agregado los alcanza
 * todavía: gestionarlos (recordatorios de vencimiento, anulación manual) no
 * lo pide el brief de esta tarea.
 */
export const InvoiceStatus = {
  Draft: "draft",
  Open: "open",
  Paid: "paid",
  PastDue: "past_due",
  Void: "void",
  Uncollectible: "uncollectible",
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
