import { Command } from "@nestjs/cqrs";

export class SetAvailabilityCommand extends Command<{ teacherId: string; slots: number }> {
  constructor(
    readonly props: {
      teacherId: string;
      slots: Array<{ weekday: number; startMinute: number; endMinute: number }>;
    },
  ) {
    super();
  }
}
