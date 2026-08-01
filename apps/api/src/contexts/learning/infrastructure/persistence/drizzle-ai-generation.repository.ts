import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  AiGenerationRepository,
  GenerationLedgerEntry,
} from "../../domain/ports/ai-generation.repository.port.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Cada llamada inserta una fila NUEVA de `ai_generations` — nunca se llama
 * dos veces con el mismo `id`: `unit_body` y `exercise_set` son dos llamadas
 * distintas al proveedor, con su propio coste, y por eso dos filas.
 */
@Injectable()
export class DrizzleAiGenerationRepository implements AiGenerationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async record(entry: GenerationLedgerEntry): Promise<void> {
    await this.drizzle.db.insert(schema.aiGenerations).values({
      id: entry.id,
      schoolId: entry.schoolId,
      kind: entry.kind,
      status: entry.status,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costCents: entry.costCents,
      creditsCharged: entry.creditsCharged,
      contentUnitId: entry.contentUnitId,
      requestedByMembershipId: entry.requestedByMembershipId,
      errorCode: entry.status === "failed" ? "generation_failed" : null,
      errorMessage: entry.errorMessage ?? null,
      createdAt: entry.now,
      finishedAt: entry.now,
    });
  }
}
