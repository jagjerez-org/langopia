import { Command } from "@nestjs/cqrs";

export class EndImpersonationCommand extends Command<{
  impersonationId: string;
  endedAt: string;
  durationSeconds: number;
}> {
  constructor(readonly props: { impersonationId: string }) {
    super();
  }
}
