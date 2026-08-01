import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { ExerciseType } from "../../domain/model/exercise-schemas.js";
import type { ExerciseId } from "../../domain/model/identifiers.js";
import type { ExerciseRecord, ExerciseRepositoryPort } from "../../domain/ports/exercise.repository.port.js";

@Injectable()
export class DrizzleExerciseRepository implements ExerciseRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(exerciseId: ExerciseId): Promise<ExerciseRecord | null> {
    const rows = await this.drizzle.db
      .select({
        id: schema.exercises.id,
        contentUnitId: schema.exercises.contentUnitId,
        type: schema.exercises.type,
      })
      .from(schema.exercises)
      .where(eq(schema.exercises.id, exerciseId.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, contentUnitId: row.contentUnitId, type: row.type as ExerciseType };
  }

  async updateContent(
    exerciseId: ExerciseId,
    params: { prompt: Record<string, unknown>; solution?: Record<string, unknown> | null },
  ): Promise<void> {
    await this.drizzle.db
      .update(schema.exercises)
      .set({ prompt: params.prompt, solution: params.solution ?? null })
      .where(eq(schema.exercises.id, exerciseId.value));
  }
}
