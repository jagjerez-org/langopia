import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  AiGenerationRepository,
  ExamGenerationLedgerEntry,
} from "../../domain/ports/ai-generation.repository.port.js";

/**
 * Implementación sobre Drizzle. Copia de `DrizzleAiGenerationRepository`
 * (`learning`) contra la MISMA tabla `ai_generations`: `kind` es siempre
 * `"exam"`, y `contentUnitId` siempre `null` (un examen no es una unidad
 * didáctica).
 */
@Injectable()
export class DrizzleAiGenerationRepository implements AiGenerationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async record(entry: ExamGenerationLedgerEntry): Promise<void> {
    await this.drizzle.db.insert(schema.aiGenerations).values({
      id: entry.id,
      schoolId: entry.schoolId,
      kind: "exam",
      status: entry.status,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costCents: entry.costCents,
      creditsCharged: entry.creditsCharged,
      contentUnitId: null,
      requestedByMembershipId: entry.requestedByMembershipId,
      errorCode: entry.status === "failed" ? "generation_failed" : null,
      errorMessage: entry.errorMessage ?? null,
      createdAt: entry.now,
      finishedAt: entry.now,
    });
  }
}
