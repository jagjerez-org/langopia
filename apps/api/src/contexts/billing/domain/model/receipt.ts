import type { Money } from "./money.vo.js";

export const ReceiptKind = {
  /** Acredita un cobro, total o parcial. */
  Payment: "payment",
  /** Acredita una devolución. Nunca sustituye ni anula el recibo original. */
  CreditNote: "credit_note",
} as const;

export type ReceiptKind = (typeof ReceiptKind)[keyof typeof ReceiptKind];

/** Un prefijo por tipo de documento: `REC-` acredita cobro, `ABN-` abona. */
const RECEIPT_PREFIX: Record<ReceiptKind, string> = {
  [ReceiptKind.Payment]: "REC",
  [ReceiptKind.CreditNote]: "ABN",
};

/**
 * Formato del número de recibo: `REC-2026-0001` para un cobro, `ABN-2026-0001`
 * para un abono.
 *
 * Independiente de `invoiceNumber` (factura y recibo no son lo mismo: la
 * factura dice lo que se debe, el recibo acredita que se pagó), y cada tipo
 * lleva SU propia serie: cobros y abonos compartían prefijo y contador, así
 * que dos documentos distintos podían acabar con el mismo número — un
 * problema contable, no estético.
 */
export function formatReceiptNumber(
  year: number,
  sequence: number,
  kind: ReceiptKind = ReceiptKind.Payment,
): string {
  return `${RECEIPT_PREFIX[kind]}-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Recibo de un cobro o de una devolución.
 *
 * No es una raíz de agregado con comportamiento propio: es el documento que
 * resulta de algo que YA ocurrió en `Invoice` (`markPaid()` o `refund()`), así
 * que se construye con una fábrica por cada hecho, nunca se modifica, y no
 * necesita repositorio — quien lo emite lo persiste como PDF (`pdfStorageKey`)
 * y lo envía por correo; el propio objeto es inmutable de principio a fin.
 *
 * Reglas del brief que esta forma hace cumplir por construcción:
 *
 *   · Un cobro parcial genera un recibo parcial: `forPayment()` recibe el
 *     importe REALMENTE cobrado en esta operación, nunca el total de la
 *     factura — no hay ningún camino para que confunda uno con otro.
 *   · Una devolución no anula el recibo: `forRefund()` construye un objeto
 *     NUEVO, de otro `kind`. No existe ningún método que borre o modifique
 *     un recibo ya emitido.
 */
export class Receipt {
  private constructor(
    readonly number: string,
    readonly kind: ReceiptKind,
    readonly invoiceId: string,
    readonly paymentId: string,
    readonly amount: Money,
    readonly method: string | null,
    readonly issuedAt: Date,
    readonly reason: string | null,
  ) {}

  static forPayment(params: {
    sequence: number;
    year: number;
    invoiceId: string;
    paymentId: string;
    amount: Money;
    method: string;
    issuedAt: Date;
  }): Receipt {
    return new Receipt(
      formatReceiptNumber(params.year, params.sequence, ReceiptKind.Payment),
      ReceiptKind.Payment,
      params.invoiceId,
      params.paymentId,
      params.amount,
      params.method,
      params.issuedAt,
      null,
    );
  }

  static forRefund(params: {
    sequence: number;
    year: number;
    invoiceId: string;
    paymentId: string;
    amount: Money;
    reason: string;
    issuedAt: Date;
  }): Receipt {
    return new Receipt(
      formatReceiptNumber(params.year, params.sequence, ReceiptKind.CreditNote),
      ReceiptKind.CreditNote,
      params.invoiceId,
      params.paymentId,
      params.amount,
      null,
      params.issuedAt,
      params.reason,
    );
  }
}
