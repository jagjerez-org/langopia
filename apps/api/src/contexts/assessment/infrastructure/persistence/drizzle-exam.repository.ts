import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Exam } from "../../domain/model/exam.aggregate.js";
import type { ExamId } from "../../domain/model/identifiers.js";
import type { ExamRepository } from "../../domain/ports/exam.repository.port.js";
import { ExamMapper } from "./exam.mapper.js";

/** Implementación del repositorio de `Exam` sobre Drizzle, contra `assessments`. */
@Injectable()
export class DrizzleExamRepository implements ExamRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(id: ExamId): Promise<Exam | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, id.value))
      .limit(1);
    return rows[0] ? ExamMapper.toDomain(rows[0]) : null;
  }

  async findOrFail(id: ExamId): Promise<Exam> {
    const found = await this.findById(id);
    if (!found) throw new NotFoundError("el examen", id.value);
    return found;
  }

  async save(exam: Exam): Promise<void> {
    const row = ExamMapper.toPersistence(exam);
    await this.drizzle.db
      .insert(schema.assessments)
      .values(row)
      .onConflictDoUpdate({
        target: schema.assessments.id,
        set: {
          score: row.score,
          maxScore: row.maxScore,
          skillBreakdown: row.skillBreakdown,
          status: row.status,
          scheduledFor: row.scheduledFor,
          startedAt: row.startedAt,
          submittedAt: row.submittedAt,
          validatedByMembershipId: row.validatedByMembershipId,
          validatedAt: row.validatedAt,
          levelResult: row.levelResult,
          sections: row.sections,
          aiScore: row.aiScore,
          aiFeedback: row.aiFeedback,
          aiModel: row.aiModel,
          aiCostCents: row.aiCostCents,
        },
      });
  }
}
