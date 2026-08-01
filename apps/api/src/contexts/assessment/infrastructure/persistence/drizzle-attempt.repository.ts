import { Injectable } from "@nestjs/common";
import { and, count, eq, lt } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { AttemptStatus, type Attempt } from "../../domain/model/attempt.aggregate.js";
import type { AttemptId, ExerciseId } from "../../domain/model/identifiers.js";
import type { AttemptRepository } from "../../domain/ports/attempt.repository.port.js";
import { AttemptMapper } from "./attempt.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que las
 * políticas RLS lo filtran todo por debajo.
 */
@Injectable()
export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: AttemptId): Promise<Attempt | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.id, id.value))
      .limit(1);
    return rows[0] ? AttemptMapper.toDomain(rows[0]) : null;
  }

  async findOrFail(id: AttemptId): Promise<Attempt> {
    const found = await this.find(id);
    if (!found) throw new NotFoundError("el intento", id.value);
    return found;
  }

  async save(attempt: Attempt): Promise<void> {
    const row = AttemptMapper.toPersistence(attempt);
    await this.drizzle.db
      .insert(schema.attempts)
      .values(row)
      .onConflictDoUpdate({
        target: schema.attempts.id,
        set: {
          response: row.response,
          status: row.status,
          aiScore: row.aiScore,
          aiFeedback: row.aiFeedback,
          aiRubricScores: row.aiRubricScores,
          aiModel: row.aiModel,
          aiCostCents: row.aiCostCents,
          teacherScore: row.teacherScore,
          teacherFeedback: row.teacherFeedback,
          validatedByMembershipId: row.validatedByMembershipId,
          validatedAt: row.validatedAt,
          durationMs: row.durationMs,
        },
      });
  }

  async countForExerciseAndStudent(params: {
    exerciseId: ExerciseId;
    studentProfileId: string;
  }): Promise<number> {
    const rows = await this.drizzle.db
      .select({ value: count() })
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.exerciseId, params.exerciseId.value),
          eq(schema.attempts.studentProfileId, params.studentProfileId),
        ),
      );
    return rows[0]?.value ?? 0;
  }

  async findAiGradedSubmittedBefore(submittedBefore: Date): Promise<Attempt[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.status, AttemptStatus.AiGraded),
          lt(schema.attempts.submittedAt, submittedBefore),
        ),
      );
    return rows.map(AttemptMapper.toDomain);
  }
}
