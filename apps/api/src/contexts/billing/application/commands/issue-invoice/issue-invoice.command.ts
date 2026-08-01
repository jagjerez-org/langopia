import { Command } from "@nestjs/cqrs";

export class IssueInvoiceCommand extends Command<{
  invoiceId: string;
  number: string;
  totalCents: number;
  currency: string;
  applicationFeeBps: number;
  applicationFeeCents: number;
}> {
  constructor(
    readonly props: {
      direction: "platform_to_school" | "school_to_student";
      /** Obligatorio en `school_to_student`; ignorado en `platform_to_school`. */
      studentId?: string | null;
      billToMembershipId?: string | null;
      lines: Array<{
        description: string;
        quantity: number;
        unitCents: number;
        courseId?: string | null;
        sessionId?: string | null;
      }>;
      /** En puntos básicos. Por defecto 2100 (21%, IVA español estándar). */
      taxRateBps?: number;
      dueOn: string;
    },
  ) {
    super();
  }
}
