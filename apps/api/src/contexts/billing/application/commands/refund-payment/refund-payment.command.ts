import { Command } from "@nestjs/cqrs";

export class RefundPaymentCommand extends Command<{
  refundId: string;
  status: "succeeded" | "pending" | "failed";
  feeReversedCents: number;
  receiptNumber: string | null;
}> {
  constructor(
    readonly props: {
      invoiceId: string;
      amountCents: number;
      /** Uno de `refund_reason` en Postgres: `requested_by_customer`, `service_not_provided`, ... */
      reason: string;
      idempotencyKey: string;
    },
  ) {
    super();
  }
}
