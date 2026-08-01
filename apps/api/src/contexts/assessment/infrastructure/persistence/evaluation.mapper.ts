import * as schema from "@langopia/db/schema";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Evaluation } from "../../domain/model/evaluation.aggregate.js";
import { EvaluationId } from "../../domain/model/identifiers.js";

type EvaluationRow = typeof schema.evaluations.$inferSelect;
type EvaluationInsert = typeof schema.evaluations.$inferInsert;

/** Columna `date` de Postgres a medianoche UTC, igual que `DateOfBirth`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Traductor entre la fila y el agregado.
 *
 * Sigue el patrón de `ClassSessionMapper`: `toDomain` usa `rehydrate`, que no
 * valida ni emite eventos —lo que está guardado ya pasó—, y `toPersistence`
 * devuelve la fila lista para escribir.
 */
export class EvaluationMapper {
  static toDomain(row: EvaluationRow): Evaluation {
    return Evaluation.rehydrate({
      id: EvaluationId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      teacherProfileId: row.teacherProfileId,
      studentProfileId: row.studentProfileId,
      periodStart: dateOnlyToUtc(row.periodStart),
      periodEnd: dateOnlyToUtc(row.periodEnd),
      progressRating: row.progressRating,
      levelAtEvaluation: row.levelAtEvaluation as CefrLevel | null,
      strengths: row.strengths,
      improvements: row.improvements,
      nextSteps: row.nextSteps,
      visibleToStudent: row.visibleToStudent,
      visibleToGuardian: row.visibleToGuardian,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(evaluation: Evaluation): EvaluationInsert {
    return {
      id: evaluation.id.value,
      schoolId: evaluation.schoolId.value,
      teacherProfileId: evaluation.teacherId.value,
      studentProfileId: evaluation.studentId.value,
      periodStart: utcToDateOnly(evaluation.periodStart),
      periodEnd: utcToDateOnly(evaluation.periodEnd),
      progressRating: evaluation.progressRating,
      levelAtEvaluation: evaluation.levelAtEvaluation,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      nextSteps: evaluation.nextSteps,
      visibleToStudent: evaluation.visibleToStudent,
      visibleToGuardian: evaluation.visibleToGuardian,
      createdAt: evaluation.createdAt,
    };
  }
}
