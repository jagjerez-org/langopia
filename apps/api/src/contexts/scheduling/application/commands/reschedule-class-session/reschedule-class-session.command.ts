import { Command } from "@nestjs/cqrs";

export class RescheduleClassSessionCommand extends Command<{
  originalSessionId: string;
  replacementSessionId: string;
}> {
  constructor(
    readonly props: {
      sessionId: string;
      newStartsAt: string;
      reason: string;
      /** Cambiar también de profesor al mover la clase. */
      newTeacherId?: string | null;
      overrideAvailability?: boolean;
    },
  ) {
    super();
  }
}
