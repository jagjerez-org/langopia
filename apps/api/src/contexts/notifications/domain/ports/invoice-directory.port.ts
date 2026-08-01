/**
 * Quién paga una factura, y los datos que hacen falta para redactar el
 * aviso. Ni `InvoiceIssued` ni `PaymentFailed` llevan `billToMembershipId` en
 * su carga útil —los eventos de dominio solo llevan lo que su propio
 * contrato necesita, no todo lo que otro contexto pueda querer algún día—,
 * así que este puerto es la única forma de saber a quién escribir.
 */
export interface InvoicePayerContext {
  billToMembershipId: string | null;
  studentId: string | null;
  number: string;
  currency: string;
  dueOn: Date | null;
}

/** Capa anticorrupción hacia `billing`: lee `invoices`, nunca importa `Invoice`. */
export interface InvoiceDirectoryPort {
  /** `null` si la factura no existe. */
  findPayerContext(invoiceId: string): Promise<InvoicePayerContext | null>;
}

export const INVOICE_DIRECTORY = Symbol("InvoiceDirectoryPort");
