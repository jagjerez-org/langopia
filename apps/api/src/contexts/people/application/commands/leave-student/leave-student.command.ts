import { Command } from "@nestjs/cqrs";

export class LeaveStudentCommand extends Command<{ studentId: string; status: string }> {
  constructor(
    readonly props: {
      studentId: string;
      reason: string;
    },
  ) {
    super();
  }
}
