import { Command } from "@nestjs/cqrs";
import type { TeacherTier } from "../../../domain/model/hourly-rate.vo.js";

export class UpdateTeacherCommand extends Command<{
  teacherId: string;
  tier: TeacherTier;
  hourlyRateCents: number;
}> {
  constructor(
    readonly props: {
      teacherId: string;
      /** Ausente: conserva el tramo actual. */
      tier?: TeacherTier;
      /** Ausente: conserva el importe actual. */
      hourlyRateCents?: number;
    },
  ) {
    super();
  }
}
