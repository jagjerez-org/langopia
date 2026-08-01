import { Command } from "@nestjs/cqrs";

export class StartImpersonationCommand extends Command<{
  impersonationId: string;
  targetMembershipId: string;
  reason: string;
  involvesMinor: boolean;
  expiresAt: string;
}> {
  constructor(
    readonly props: {
      targetMembershipId: string;
      reason: string;
      /** De la sesión de Better Auth ya verificada, nunca de algo que escriba el cliente. */
      actorAuthUserId: string;
      actorEmail: string;
      actorName: string;
    },
  ) {
    super();
  }
}
