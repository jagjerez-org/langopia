/**
 * Formas de respuesta del contexto `billing` (Tarea 10 del panel).
 *
 * Una sola definición para los dos lados, igual que `scheduling.ts` (Tarea 9):
 * la API las declara en su puerto de lectura (`billing-read-model.port.ts`) y
 * sus manejadores de consulta, y el panel tipa con ellas la respuesta de
 * `GET /billing/*`. Puros datos, sin comportamiento: nadie los guarda ni
 * decide nada con ellos aquí.
 *
 * Los importes viajan en céntimos ENTEROS, tal cual los entrega el dominio de
 * facturación (`Invoice`, `Money`) — este paquete no divide entre 100 ni sube
 * ni baja ni un céntimo, y tampoco debe hacerlo quien lo consume
 * (`OLA-1-WEB.md`: cero lógica de negocio en el frontend). Las fechas van en
 * ISO 8601 UTC.
 */

/** Una línea de la factura, tal cual la guarda `InvoiceLine`. */
export type InvoiceLineView = {
  id: string;
  description: string;
  quantity: number;
  unitCents: number;
  /** `quantity * unitCents`, ya calculado por el dominio — no se repite la cuenta aquí. */
  totalCents: number;
  courseId: string | null;
  sessionId: string | null;
};

/** Un cobro (`payments`), total o parcial, contra una factura. */
export type PaymentView = {
  paymentId: string;
  status: string;
  method: string;
  amountCents: number;
  currency: string;
  /**
   * Comisión de plataforma RETENIDA en este cobro concreto — no la de la
   * factura entera si se cobró en varias veces. Congelada al cobrar, igual
   * que `applicationFeeCents` de la factura se congela al emitir.
   */
  applicationFeeCents: number;
  provider: string;
  paidAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
};

/** Una devolución (`refunds`) sobre un cobro ya existente. */
export type RefundView = {
  refundId: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
  reversesApplicationFee: boolean;
  applicationFeeReversedCents: number;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
};

/** Fila de `GET /billing/invoices` (Tarea 10, Paso 1). */
export type InvoiceListItem = {
  invoiceId: string;
  number: string;
  direction: string;
  status: string;
  currency: string;
  /** Nombre de quien recibe la factura (alumno adulto o tutor). `null` en `platform_to_school`. */
  billedToName: string | null;
  totalCents: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  /** Al menos un intento de cobro con `status = 'failed'`. La lista completa vive en el detalle. */
  hasFailedPayment: boolean;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: string | null;
};

/** Lo que devuelve `GET /billing/invoices/:id` (Tarea 10, Paso 2). */
export type InvoiceDetail = {
  invoiceId: string;
  number: string;
  direction: string;
  status: string;
  currency: string;
  locale: string;
  billedToName: string | null;
  subtotalCents: number;
  taxCents: number;
  taxRateBps: number;
  totalCents: number;
  /** Congelada al emitir: una factura antigua conserva la comisión que tenía entonces. */
  applicationFeeBps: number;
  applicationFeeCents: number;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: string | null;
  amountPaidCents: number;
  amountRefundedCents: number;
  /** `Invoice.remainingBalance`: lo que queda por cobrar. */
  remainingCents: number;
  /** `Invoice.refundableBalance`: lo que queda por devolver, descontando lo ya pedido y sin confirmar. */
  refundableCents: number;
  lines: InvoiceLineView[];
  payments: PaymentView[];
  refunds: RefundView[];
};

/** Lo que devuelve `GET /billing/invoices/summary`: el total facturado este mes (Tarea 10, Paso 1). */
export type InvoiceMonthlyTotal = {
  currency: string;
  totalCents: number;
};

/** Lo que devuelve `GET /billing/merchant/status` (Tarea 10, Paso 4). */
export type MerchantAccountStatus = {
  merchantStatus: "not_started" | "pending" | "active" | "restricted" | "disabled";
  applicationFeeEnabled: boolean;
  applicationFeeBps: number;
  applicationFeeCapCents: number | null;
  currency: string;
};
