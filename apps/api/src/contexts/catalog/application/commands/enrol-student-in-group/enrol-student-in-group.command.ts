import { Command } from "@nestjs/cqrs";

export class EnrolStudentInGroupCommand extends Command<{ enrollmentId: string }> {
  constructor(
    readonly props: {
      groupId: string;
      studentId: string;
      agreedPriceCents?: number | null;
    },
  ) {
    super();
  }
}
