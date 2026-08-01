import { Command } from "@nestjs/cqrs";

export class InviteMemberCommand extends Command<{
  invitationId: string;
  token: string;
  expiresAt: string;
}> {
  constructor(
    readonly props: {
      email: string;
      role: string;
    },
  ) {
    super();
  }
}
