import { Command } from "@nestjs/cqrs";

export class CancelClassSessionCommand extends Command<{
  sessionId: string;
  refundDue: boolean;
  noticeHours: number;
}> {
  constructor(
    readonly props: {
      sessionId: string;
      /** Quién cancela. Decide si hay derecho a devolución. */
      party: "school" | "student";
      reason: string;
    },
  ) {
    super();
  }
}
