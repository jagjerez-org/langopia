import * as schema from "@langopia/db/schema";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Exam, type ExamKind, type ExamSection, type ExamStatus } from "../../domain/model/exam.aggregate.js";
import { ExamId } from "../../domain/model/identifiers.js";

type ExamRow = typeof schema.assessments.$inferSelect;
type ExamInsert = typeof schema.assessments.$inferInsert;

/**
 * Traductor entre la fila de `assessments` y el agregado `Exam`.
 *
 * Reutiliza dos columnas ya pensadas para «medir el avance real del alumno
 * en la escala MCER» en vez de inventar dos nuevas: `levelBefore` es el
 * nivel que examina (`Exam.level`), y `levelResult` es el nivel que
 * PROPONE si `validate()` aprueba un `level_exam` (`Exam.proposedLevelUpgrade`)
 * — nunca el nivel que se aplica solo.
 */
export class ExamMapper {
  static toDomain(row: ExamRow): Exam {
    const exam = Exam.rehydrate({
      id: ExamId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      kind: row.kind as ExamKind,
      studentProfileId: row.studentProfileId,
      title: row.title,
      language: row.language,
      // Toda fila de `Exam` la escribe esta misma clase con `levelBefore`
      // siempre presente (ver `toPersistence`): el `as` es seguro aquí.
      level: row.levelBefore as CefrLevel,
      sourceContentUnitIds: row.sourceContentUnitIds,
      skillDistribution: row.skillDistribution ?? {},
      sections: (row.sections ?? []) as unknown as ExamSection[],
      durationMinutes: row.durationMinutes ?? 0,
      mockFramework: row.mockFramework,
      status: row.status as ExamStatus,
      scheduledFor: row.scheduledFor,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      score: row.score,
      aiScore: row.aiScore,
      aiFeedback: row.aiFeedback,
      aiModel: row.aiModel,
      aiCostCents: row.aiCostCents,
      validatedByMembershipId: row.validatedByMembershipId,
      validatedAt: row.validatedAt,
      proposedLevelUpgrade: row.levelResult as CefrLevel | null,
      createdAt: row.createdAt,
    });
    // `rehydrate()` no recalcula el desglose por destreza (no es parte del
    // estado que recibe el constructor: ver `exam.aggregate.ts`). Sin este
    // paso, cargar un examen ya corregido y volver a guardarlo desde
    // cualquier manejador que no sea `grade-exam` (p. ej. `validate-exam`)
    // borraría el desglose ya persistido — lo detectó la verificación en
    // vivo de esta tarea contra la API real.
    exam.recomputeSkillBreakdown();
    return exam;
  }

  static toPersistence(exam: Exam): ExamInsert {
    const skillBreakdown = Object.keys(exam.skillBreakdown).length > 0 ? exam.skillBreakdown : null;
    return {
      id: exam.id.value,
      schoolId: exam.schoolId.value,
      kind: exam.kind,
      studentProfileId: exam.studentProfileId,
      title: exam.title,
      language: exam.language,
      levelBefore: exam.level,
      levelResult: exam.proposedLevelUpgrade,
      score: exam.score,
      maxScore: exam.maxScore,
      skillBreakdown,
      status: exam.status,
      scheduledFor: exam.scheduledFor,
      startedAt: exam.startedAt,
      submittedAt: exam.submittedAt,
      validatedByMembershipId: exam.validatedByMembershipId,
      validatedAt: exam.validatedAt,
      sourceContentUnitIds: [...exam.sourceContentUnitIds],
      skillDistribution: exam.skillDistribution,
      sections: exam.sections as unknown as schema.ExamSectionRow[],
      durationMinutes: exam.durationMinutes,
      mockFramework: exam.mockFramework,
      aiScore: exam.aiScore,
      aiFeedback: exam.aiFeedback,
      aiModel: exam.aiModel,
      aiCostCents: exam.aiCostCents,
      createdAt: exam.createdAt,
    };
  }
}
