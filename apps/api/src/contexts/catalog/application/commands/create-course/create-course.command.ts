import { Command } from "@nestjs/cqrs";

export class CreateCourseCommand extends Command<{ courseId: string }> {
  constructor(
    readonly props: {
      code: string;
      language: string;
      level: string;
      modality: string;
      totalSessions?: number;
      sessionMinutes?: number;
      maxStudents?: number;
      priceCents: number;
      currency?: string;
      translations: Array<{ locale: string; name: string; description?: string | null }>;
    },
  ) {
    super();
  }
}
