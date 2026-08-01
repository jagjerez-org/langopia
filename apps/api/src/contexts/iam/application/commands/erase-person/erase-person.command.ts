import { Command } from "@nestjs/cqrs";

export class ErasePersonCommand extends Command<{
  membershipId: string;
  erasedAt: string;
  recordingsDeleted: number;
  segmentsAnonymized: number;
}> {
  constructor(readonly props: { membershipId: string }) {
    super();
  }
}
