import { Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { RubricCriterion } from "../../domain/model/rubric.vo.js";
import type { ContentUnitId, ExerciseId } from "../../domain/model/identifiers.js";
import type {
  ExamSourceUnit,
  ExerciseSourceInfo,
} from "../../domain/ports/exercise-source.port.js";

/**
 * Acceso a datos de `learning` que necesita Assessment para corregir un
 * intento. Vive aquí, y no en `infrastructure/acl/`, porque el acceso a
 * datos vive en un repositorio (`ARCHITECTURE.md`):
 * `LearningExerciseSourceAdapter` delega en esta clase en lugar de escribir
 * SQL él mismo. `exercises`, `content_units` y `rubrics` son de `learning`;
 * esto NO es un cruce de dominio —no se importa nada de
 * `contexts/learning/`—, es una consulta de lectura contra el esquema
 * compartido, igual que `DrizzleTeachesStudentRepository` (`assessment` →
 * `scheduling`).
 */
@Injectable()
export class DrizzleExerciseSourceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async get(exerciseId: ExerciseId): Promise<ExerciseSourceInfo | null> {
    const rows = await this.drizzle.db
      .select({
        type: schema.exercises.type,
        solution: schema.exercises.solution,
        prompt: schema.exercises.prompt,
        rubricId: schema.exercises.rubricId,
        requiresTeacherValidation: schema.exercises.requiresTeacherValidation,
        maxAttempts: schema.exercises.maxAttempts,
        maxScore: schema.exercises.maxScore,
        level: schema.exercises.level,
        language: schema.contentUnits.language,
        rubricCode: schema.rubrics.code,
        rubricMaxScore: schema.rubrics.maxScore,
        rubricCriteria: schema.rubrics.criteria,
      })
      .from(schema.exercises)
      .innerJoin(schema.contentUnits, eq(schema.exercises.contentUnitId, schema.contentUnits.id))
      .leftJoin(schema.rubrics, eq(schema.exercises.rubricId, schema.rubrics.id))
      .where(eq(schema.exercises.id, exerciseId.value))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const prompt = row.prompt as Record<string, unknown>;
    const task = typeof prompt["task"] === "string" ? (prompt["task"] as string) : null;

    return {
      type: row.type,
      solution: row.solution,
      rubricId: row.rubricId,
      rubricCode: row.rubricCode,
      rubricMaxScore: row.rubricMaxScore,
      rubricCriteria: (row.rubricCriteria as RubricCriterion[] | null) ?? null,
      requiresTeacherValidation: row.requiresTeacherValidation,
      maxAttempts: row.maxAttempts,
      maxScore: row.maxScore,
      language: row.language,
      level: row.level,
      task,
    };
  }

  /**
   * Unidades para generar un examen (Tarea 15): nivel, destreza y los
   * ejercicios de práctica ya existentes (para no repetirlos literalmente).
   * Dos consultas —unidades y ejercicios— en vez de un `LEFT JOIN`, porque
   * una unidad sin ejercicios todavía no debería multiplicar filas ni
   * complicar el `GROUP BY`; se combinan en memoria, que es barato para el
   * puñado de unidades que entran en un examen.
   */
  async getUnits(contentUnitIds: readonly ContentUnitId[]): Promise<readonly ExamSourceUnit[]> {
    if (contentUnitIds.length === 0) return [];
    const ids = contentUnitIds.map((id) => id.value);

    const units = await this.drizzle.db
      .select({
        id: schema.contentUnits.id,
        language: schema.contentUnits.language,
        level: schema.contentUnits.level,
        status: schema.contentUnits.status,
        topic: schema.contentUnits.topic,
      })
      .from(schema.contentUnits)
      .where(inArray(schema.contentUnits.id, ids));

    if (units.length === 0) return [];

    const exerciseRows = await this.drizzle.db
      .select({
        id: schema.exercises.id,
        contentUnitId: schema.exercises.contentUnitId,
        type: schema.exercises.type,
        skill: schema.exercises.skill,
        prompt: schema.exercises.prompt,
      })
      .from(schema.exercises)
      .where(
        inArray(
          schema.exercises.contentUnitId,
          units.map((u) => u.id),
        ),
      );

    return units.map((unit) => ({
      id: unit.id,
      language: unit.language,
      level: unit.level,
      status: unit.status,
      topic: unit.topic,
      exercises: exerciseRows
        .filter((e) => e.contentUnitId === unit.id)
        .map((e) => ({
          id: e.id,
          type: e.type,
          skill: e.skill,
          prompt: e.prompt as Record<string, unknown>,
        })),
    }));
  }

  /** Rúbrica por código, para los ítems del examen que se corrigen con rúbrica. */
  async getRubricByCode(
    code: string,
  ): Promise<{ id: string; maxScore: number; criteria: readonly RubricCriterion[] } | null> {
    const rows = await this.drizzle.db
      .select({
        id: schema.rubrics.id,
        maxScore: schema.rubrics.maxScore,
        criteria: schema.rubrics.criteria,
      })
      .from(schema.rubrics)
      .where(eq(schema.rubrics.code, code))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return { id: row.id, maxScore: row.maxScore, criteria: row.criteria as RubricCriterion[] };
  }
}
