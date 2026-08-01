import { Command } from "@nestjs/cqrs";

export class RecordPaymentCommand extends Command<{
  paymentId: string;
  status: "succeeded" | "pending" | "failed";
  invoiceStatus: string;
  amountCents: number;
  receiptNumber: string | null;
}> {
  constructor(
    readonly props: {
      invoiceId: string;
      payerEmail: string;
      payerProviderCustomerRef?: string | null;
      /** Céntimos a cobrar. Por defecto, lo que queda pendiente de la factura. */
      amountCents?: number | null;
      method?: string;
      /** Cobrar dos veces por un reintento es un problema de negocio: obligatoria. */
      idempotencyKey: string;
    },
  ) {
    super();
  }
}
