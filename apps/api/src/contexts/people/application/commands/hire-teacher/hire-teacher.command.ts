import { Command } from "@nestjs/cqrs";
import type { TeacherTier } from "../../../domain/model/hourly-rate.vo.js";

export class HireTeacherCommand extends Command<{ teacherId: string }> {
  constructor(
    readonly props: {
      name: string;
      email: string;
      tier: TeacherTier;
      hourlyRateCents: number;
      contractedHoursPerWeek: number;
      /** AAAA-MM-DD. */
      hiredAt: string;
      locale?: string | null;
    },
  ) {
    super();
  }
}
