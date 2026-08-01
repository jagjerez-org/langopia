import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  FEEDBACK_READ_MODEL,
  type FeedbackReadModel,
  type TeacherProductivitySignals,
} from "../../ports/feedback-read-model.port.js";

const STALE_EVALUATION_DAYS = 21;
const UNSIGNED_CORRECTION_DAYS = 7;
const UNDERUSED_BELOW = 0.6;
const OVERLOADED_ABOVE = 0.9;
const LOW_CSAT_BELOW = 4;

export type TeacherProductivitySignal = "healthy" | "needs_attention";

export type TeacherProductivityRow = TeacherProductivitySignals & {
  signal: TeacherProductivitySignal;
  reasons: string[];
};

export class GetTeacherProductivityQuery extends Query<TeacherProductivityRow[]> {
  constructor(readonly props: { from: string; to: string }) {
    super();
  }
}

@QueryHandler(GetTeacherProductivityQuery)
export class GetTeacherProductivityHandler
  implements IQueryHandler<GetTeacherProductivityQuery>
{
  constructor(@Inject(FEEDBACK_READ_MODEL) private readonly readModel: FeedbackReadModel) {}

  async execute(query: GetTeacherProductivityQuery): Promise<TeacherProductivityRow[]> {
    const from = new Date(query.props.from);
    const to = new Date(query.props.to);
    const rows = await this.readModel.teacherProductivityBetween({
      from,
      to,
      staleEvaluationFrom: new Date(to.getTime() - STALE_EVALUATION_DAYS * 24 * 3_600_000),
      unsignedCorrectionBefore: new Date(to.getTime() - UNSIGNED_CORRECTION_DAYS * 24 * 3_600_000),
    });

    return rows
      .map((row) => {
        const reasons = productivityReasons(row);
        return {
          ...row,
          signal: reasons.length > 0 ? ("needs_attention" as const) : ("healthy" as const),
          reasons,
        };
      })
      .sort(
        (a, b) =>
          Number(b.signal === "needs_attention") - Number(a.signal === "needs_attention") ||
          b.reasons.length - a.reasons.length ||
          b.occupancyRate - a.occupancyRate ||
          a.teacherName.localeCompare(b.teacherName, "es"),
      );
  }
}

function productivityReasons(row: TeacherProductivitySignals): string[] {
  const reasons: string[] = [];

  if (row.occupancyRate >= OVERLOADED_ABOVE) reasons.push("Ocupación por encima del 90 %");
  else if (row.occupancyRate < UNDERUSED_BELOW) reasons.push("Ocupación por debajo del 60 %");

  if (row.studentsWithoutEvaluation > 0) {
    const names = row.studentsWithoutEvaluationNames.slice(0, 3).join(", ");
    const suffix = names ? `: ${names}` : "";
    reasons.push(`${row.studentsWithoutEvaluation} ${plural(row.studentsWithoutEvaluation, "alumno", "alumnos")} sin valorar en 3 semanas${suffix}`);
  }

  if (row.averageCsat !== null && row.averageCsat < LOW_CSAT_BELOW) {
    reasons.push(`CSAT medio por debajo de 4 (${row.averageCsat})`);
  } else if (row.csatResponses === 0) {
    reasons.push("Sin CSAT en el periodo");
  }

  if (row.unsignedCorrectionsOlderThan7Days > 0) {
    reasons.push(
      `${row.unsignedCorrectionsOlderThan7Days} ${plural(
        row.unsignedCorrectionsOlderThan7Days,
        "corrección",
        "correcciones",
      )} sin firmar desde hace más de 7 días`,
    );
  }

  if (row.pendingNegativeMaterialReviews > 0) {
    reasons.push(
      `${row.pendingNegativeMaterialReviews} ${plural(
        row.pendingNegativeMaterialReviews,
        "reseña negativa de material pendiente",
        "reseñas negativas de material pendientes",
      )}`,
    );
  }

  if (row.lateStartedSessions > 0) {
    reasons.push(
      `${row.lateStartedSessions} ${plural(
        row.lateStartedSessions,
        "clase empezó tarde",
        "clases empezaron tarde",
      )}`,
    );
  }

  return reasons;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
