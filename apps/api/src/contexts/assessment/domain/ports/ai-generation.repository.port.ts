/**
 * Una llamada real al modelo para generar un examen, lista para insertarse
 * como una fila de `ai_generations` (`packages/db/src/schema/platform.ts`).
 * Se registra tanto si la llamada terminó en éxito como si falló (el
 * proveedor cobra igual) — regla de la ola: «el coste se registra antes de
 * descontar créditos».
 *
 * Copia propia de `learning/domain/ports/ai-generation.repository.port.ts`
 * (`assessment` no la importa: `ARCHITECTURE.md`). `kind` es siempre
 * `"exam"` — el único valor de `ai_generation_kind` que produce esta
 * tarea—, y `contentUnitId` no aplica aquí (un examen no es una unidad
 * didáctica): la fila no lo lleva.
 */
export type ExamGenerationLedgerEntry = {
  /** Fijado por quien llama: el mismo id enlaza el gasto de créditos con esta fila. */
  id: string;
  schoolId: string;
  status: "succeeded" | "failed";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  creditsCharged: number;
  requestedByMembershipId: string;
  errorMessage?: string | null;
  now: Date;
};

/** Registro (append-only) de generaciones de examen con IA. */
export interface AiGenerationRepository {
  record(entry: ExamGenerationLedgerEntry): Promise<void>;
}

export const AI_GENERATION_REPOSITORY = Symbol("AiGenerationRepository");
