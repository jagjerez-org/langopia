import * as schema from "@langopia/db/schema";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Attempt, type AttemptStatus } from "../../domain/model/attempt.aggregate.js";
import { AttemptId, ExerciseId } from "../../domain/model/identifiers.js";

type AttemptRow = typeof schema.attempts.$inferSelect;
type AttemptInsert = typeof schema.attempts.$inferInsert;

/**
 * Traductor entre la fila y el agregado.
 *
 * Sigue el patrón de `EvaluationMapper`: `toDomain` usa `rehydrate`, que no
 * valida ni emite eventos —lo que está guardado ya pasó—, y `toPersistence`
 * devuelve la fila lista para escribir.
 */
export class AttemptMapper {
  static toDomain(row: AttemptRow): Attempt {
    return Attempt.rehydrate({
      id: AttemptId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      exerciseId: ExerciseId.of(row.exerciseId),
      studentProfileId: row.studentProfileId,
      sessionId: row.sessionId,
      assessmentId: row.assessmentId,
      attemptNumber: row.attemptNumber,
      response: row.response,
      status: row.status as AttemptStatus,
      aiScore: row.aiScore,
      aiFeedback: row.aiFeedback,
      aiRubricScores: row.aiRubricScores,
      aiModel: row.aiModel,
      aiCostCents: row.aiCostCents,
      teacherScore: row.teacherScore,
      teacherFeedback: row.teacherFeedback,
      validatedByMembershipId: row.validatedByMembershipId,
      validatedAt: row.validatedAt,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      durationMs: row.durationMs,
    });
  }

  static toPersistence(attempt: Attempt): AttemptInsert {
    return {
      id: attempt.id.value,
      schoolId: attempt.schoolId.value,
      exerciseId: attempt.exerciseId.value,
      studentProfileId: attempt.studentProfileId,
      sessionId: attempt.sessionId,
      assessmentId: attempt.assessmentId,
      attemptNumber: attempt.attemptNumber,
      response: attempt.response,
      status: attempt.status,
      aiScore: attempt.aiScore,
      aiFeedback: attempt.aiFeedback,
      aiRubricScores: attempt.aiRubricScores,
      aiModel: attempt.aiModel,
      aiCostCents: attempt.aiCostCents,
      teacherScore: attempt.teacherScore,
      teacherFeedback: attempt.teacherFeedback,
      validatedByMembershipId: attempt.validatedByMembershipId,
      validatedAt: attempt.validatedAt,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      durationMs: attempt.durationMs,
    };
  }
}
