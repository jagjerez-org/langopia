import { Command } from "@nestjs/cqrs";

export class CreateGroupCommand extends Command<{ groupId: string }> {
  constructor(
    readonly props: {
      courseId: string;
      teacherId?: string | null;
      name: string;
      startsOn: string;
      endsOn?: string | null;
    },
  ) {
    super();
  }
}
