import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Evaluation } from "../../domain/model/evaluation.aggregate.js";
import type { EvaluationId, StudentId, TeacherId } from "../../domain/model/identifiers.js";
import type { EvaluationRepository } from "../../domain/ports/evaluation.repository.port.js";
import { EvaluationMapper } from "./evaluation.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que las
 * políticas RLS lo filtran todo por debajo.
 */
@Injectable()
export class DrizzleEvaluationRepository implements EvaluationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: EvaluationId): Promise<Evaluation | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, id.value))
      .limit(1);
    return rows[0] ? EvaluationMapper.toDomain(rows[0]) : null;
  }

  async findOrFail(id: EvaluationId): Promise<Evaluation> {
    const found = await this.find(id);
    if (!found) throw new NotFoundError("la valoración", id.value);
    return found;
  }

  async save(evaluation: Evaluation): Promise<void> {
    const row = EvaluationMapper.toPersistence(evaluation);
    await this.drizzle.db
      .insert(schema.evaluations)
      .values(row)
      .onConflictDoUpdate({
        target: schema.evaluations.id,
        set: {
          progressRating: row.progressRating,
          levelAtEvaluation: row.levelAtEvaluation,
          strengths: row.strengths,
          improvements: row.improvements,
          nextSteps: row.nextSteps,
          visibleToStudent: row.visibleToStudent,
          visibleToGuardian: row.visibleToGuardian,
        },
      });
  }

  async findByTeacherAndStudent(params: {
    teacherId: TeacherId;
    studentId: StudentId;
  }): Promise<Evaluation[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.evaluations)
      .where(
        and(
          eq(schema.evaluations.teacherProfileId, params.teacherId.value),
          eq(schema.evaluations.studentProfileId, params.studentId.value),
        ),
      );
    return rows.map(EvaluationMapper.toDomain);
  }
}
