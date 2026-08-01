import type { Invoice } from "../model/invoice.aggregate.js";
import type { ReceiptKind } from "../model/receipt.js";
import type { InvoiceId } from "../model/identifiers.js";
import type { ProviderRef } from "./payment-gateway.port.js";

/**
 * Un cobro (o una devolución) que ya ocurrió en el proveedor de pago para el
 * pago succeeded más reciente de una factura que cubre esa sesión.
 *
 * Lo usa `OnClassSessionCanceled` (paso 8) para saber CONTRA QUÉ cobro real
 * abrir la devolución cuando una clase se cancela con derecho a ella. No es
 * un agregado: es la proyección mínima que ese caso de uso necesita, así que
 * vive como tipo de retorno del repositorio, no como una entidad propia.
 */
export type PaidSessionCharge = {
  invoiceId: string;
  paymentId: string;
  charge: ProviderRef;
  /**
   * Lo cobrado por la línea de ESTA sesión dentro de la factura, IMPUESTOS
   * INCLUIDOS (`Invoice.grossAmountForSession`) — no el total de la factura,
   * y tampoco el `total_cents` de la línea, que va antes de IVA.
   */
  lineAmountCents: number;
  currency: string;
};

/**
 * Repositorio de la raíz de agregado `Invoice`, más las operaciones sobre
 * `payments`/`refunds` que le son inseparables: ninguna de las dos tablas
 * tiene sentido sin una factura, y separar su acceso a datos en repositorios
 * distintos no compraría nada — seguirían escribiendo en el mismo esquema y
 * dentro de la misma transacción.
 *
 * `Payment` y `Refund` no son agregados propios (ver la nota en
 * `invoice.aggregate.ts`): por eso este puerto los registra con métodos
 * directos en vez de cargar-modificar-guardar.
 */
export interface InvoiceRepository {
  find(id: InvoiceId): Promise<Invoice | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: InvoiceId): Promise<Invoice>;

  /** Persiste la factura y sus líneas. No toca `payments` ni `refunds`. */
  save(invoice: Invoice): Promise<void>;

  /**
   * Siguiente número correlativo para una factura de esta escuela, en el año
   * dado. Empieza en 1 cada año — es responsabilidad de quien llama darle el
   * prefijo (`LGP-` para `platform_to_school`, sin prefijo para
   * `school_to_student`, igual que hace el seed).
   */
  nextInvoiceNumber(year: number): Promise<number>;

  /** Registra un cobro (total o parcial) ya resuelto por el proveedor de pago. */
  recordPayment(params: {
    schoolId: string;
    invoiceId: InvoiceId;
    amountCents: number;
    currency: string;
    method: string;
    applicationFeeCents: number;
    charge: ProviderRef;
    merchantRef: string | null;
    status: "succeeded" | "pending" | "failed";
    failureCode?: string | null;
    failureMessage?: string | null;
    paidAt: Date | null;
  }): Promise<{ paymentId: string }>;

  /**
   * Registra una devolución sobre un cobro ya existente, y actualiza el
   * estado de ese cobro (`refunded`/`partially_refunded`).
   */
  recordRefund(params: {
    schoolId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
    reason: string;
    applicationFeeReversedCents: number;
    refund: ProviderRef;
    status: "succeeded" | "pending" | "failed";
    requestedByMembershipId: string | null;
    fullyRefunded: boolean;
    now: Date;
  }): Promise<{ refundId: string }>;

  /**
   * UN cobro por cada persona matriculada que pagó esta sesión: una clase de
   * grupo de ocho tiene ocho facturas distintas con una línea de la misma
   * sesión, y cancelarla debe devolverles a las ocho. Lista vacía si la clase
   * nunca se llegó a cobrar — en ese caso no hay nada que devolver.
   *
   * Devuelve el cobro correcto (succeeded) más reciente de cada factura.
   */
  findPaidChargesForSession(sessionId: string): Promise<PaidSessionCharge[]>;

  /**
   * El cobro (succeeded) más reciente de una factura, para saber contra qué
   * cargo real pedir la devolución. `null` si la factura nunca se cobró.
   */
  findLatestSucceededPayment(
    invoiceId: InvoiceId,
  ): Promise<{ paymentId: string; charge: ProviderRef } | null>;

  /**
   * RESERVA el siguiente número correlativo de recibo para esta escuela, en el
   * año y la serie dados, y lo devuelve. No es una consulta: entrega un número
   * y lo da por gastado, así que dos llamadas nunca devuelven el mismo —ni
   * siquiera simultáneas—. Cobros y abonos llevan series separadas: son
   * documentos distintos y compartir contador los hacía chocar.
   *
   * Independiente de la numeración de facturas (brief, paso 10).
   */
  nextReceiptSequence(params: {
    schoolId: string;
    year: number;
    kind: ReceiptKind;
  }): Promise<number>;

  /**
   * El cobro (de cualquier estado) con esta referencia del proveedor.
   *
   * Lo usa la reconciliación de un webhook (Tarea 8, paso 4): un cobro que
   * `RecordPaymentHandler` ya registró como `pending` porque el proveedor no
   * confirmó al instante, y cuya confirmación asíncrona llega después. `null`
   * si ningún cobro nuestro tiene esa referencia — un evento que no nos
   * pertenece.
   */
  findPaymentByProviderRef(providerRef: string): Promise<{
    paymentId: string;
    invoiceId: string;
    status: "succeeded" | "pending" | "failed";
    amountCents: number;
    currency: string;
    method: string;
  } | null>;

  /**
   * Confirma que un cobro pendiente se resolvió con éxito, con la comisión
   * ya calculada por quien llama (`Invoice.proportionalFee()`) — al
   * insertarla como `pending` no se conocía todavía si de verdad se iba a
   * cobrar, y `recordPayment()` la guardó en cero. No toca la factura: eso lo
   * decide quien llama, contra `Invoice.markPaid()`, antes de guardarla —
   * este método solo dice «este cobro, en concreto, ya se sabe definitivo».
   *
   * `amountCents`/`currency` son los del EVENTO del proveedor: si difieren de
   * lo que se guardó al abrir el cobro, la fila se corrige, porque quien movió
   * el dinero fue él.
   */
  markPaymentSucceeded(params: {
    paymentId: string;
    amountCents: number;
    currency: string;
    applicationFeeCents: number;
    paidAt: Date;
  }): Promise<void>;

  /**
   * La devolución (de cualquier estado) con esta referencia del proveedor.
   * Simétrico a `findPaymentByProviderRef`, para la misma reconciliación de
   * un webhook, del lado de las devoluciones.
   */
  findRefundByProviderRef(providerRef: string): Promise<{
    refundId: string;
    invoiceId: string;
    status: "succeeded" | "pending" | "failed";
    amountCents: number;
    currency: string;
    /** La que ya se dio al abrirla (`RefundPaymentCommand.reason`), no una que invente el webhook. */
    reason: string;
  } | null>;

  /**
   * Confirma que una devolución pendiente se resolvió con éxito, con la
   * comisión proporcional ya calculada por quien llama
   * (`Invoice.proportionalFee()`) — al insertarla como `pending` no se
   * conocía todavía si de verdad se iba a revertir.
   */
  markRefundSucceeded(params: {
    refundId: string;
    applicationFeeReversedCents: number;
    processedAt: Date;
    fullyRefunded: boolean;
  }): Promise<void>;
}

export const INVOICE_REPOSITORY = Symbol("InvoiceRepository");
