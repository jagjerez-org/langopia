/**
 * Una llamada real al modelo, lista para insertarse como una fila de
 * `ai_generations` (`packages/db/src/schema/platform.ts`) — «la tabla que
 * sostiene la economía del producto», y la regla de la ola que la exige:
 * «el coste se registra antes de descontar créditos». Se registra tanto si
 * la llamada terminó en éxito como si falló (el proveedor cobra igual).
 */
export type GenerationLedgerEntry = {
  /** Fijado por quien llama (tarea 6: el mismo id enlaza el gasto de créditos con esta fila). */
  id: string;
  schoolId: string;
  /** `unit_body` (el texto de la unidad) o `exercise_set` (los ejercicios): los dos tipos que produce `ContentGeneratorPort`. */
  kind: "unit_body" | "exercise_set";
  status: "succeeded" | "failed";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  creditsCharged: number;
  contentUnitId: string | null;
  requestedByMembershipId: string;
  errorMessage?: string | null;
  now: Date;
};

/** Registro (append-only, en el sentido de que cada llamada es una fila nueva) de generaciones con IA. */
export interface AiGenerationRepository {
  record(entry: GenerationLedgerEntry): Promise<void>;
}

export const AI_GENERATION_REPOSITORY = Symbol("AiGenerationRepository");
