import { Injectable } from "@nestjs/common";
import type { RubricCriterion } from "../../domain/model/rubric.vo.js";
import type { ContentUnitId, ExerciseId } from "../../domain/model/identifiers.js";
import type {
  ExamSourceUnit,
  ExerciseSourceInfo,
  ExerciseSourcePort,
} from "../../domain/ports/exercise-source.port.js";
import { DrizzleExerciseSourceRepository } from "../persistence/drizzle-exercise-source.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Contenido (`learning`).
 *
 * Assessment necesita un puñado de datos de un ejercicio para corregir un
 * intento —tipo, solución, rúbrica, tope de reintentos— y no debe saber nada
 * más: ni de `Exercise`, ni de `ContentUnit`. El acceso a datos vive en
 * `DrizzleExerciseSourceRepository` (`infrastructure/persistence/`): este
 * adaptador delega, no escribe SQL.
 */
@Injectable()
export class LearningExerciseSourceAdapter implements ExerciseSourcePort {
  constructor(private readonly repository: DrizzleExerciseSourceRepository) {}

  get(exerciseId: ExerciseId): Promise<ExerciseSourceInfo | null> {
    return this.repository.get(exerciseId);
  }

  getUnits(contentUnitIds: readonly ContentUnitId[]): Promise<readonly ExamSourceUnit[]> {
    return this.repository.getUnits(contentUnitIds);
  }

  getRubricByCode(
    code: string,
  ): Promise<{ id: string; maxScore: number; criteria: readonly RubricCriterion[] } | null> {
    return this.repository.getRubricByCode(code);
  }
}
