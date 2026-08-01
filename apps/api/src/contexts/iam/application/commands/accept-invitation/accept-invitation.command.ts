import { Command } from "@nestjs/cqrs";

export class AcceptInvitationCommand extends Command<{
  schoolId: string;
  role: string;
  membershipId: string;
}> {
  constructor(
    readonly props: {
      token: string;
      authUserId: string;
      email: string;
      name: string;
    },
  ) {
    super();
  }
}
