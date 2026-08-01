import { Command } from "@nestjs/cqrs";

export class ReleaseTeacherCommand extends Command<{ teacherId: string; status: string }> {
  constructor(
    readonly props: {
      teacherId: string;
      reason: string;
    },
  ) {
    super();
  }
}
