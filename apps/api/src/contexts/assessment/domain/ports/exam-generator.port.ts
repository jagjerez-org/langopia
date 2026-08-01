/**
 * Coste real de una llamada al modelo. Se devuelve SIEMPRE que se llama al
 * proveedor —también cuando la generación termina en fallo tras el
 * reintento—: el proveedor cobra la llamada se valide o no la salida
 * (regla de la ola 2: «el coste se registra antes de descontar créditos»).
 */
export type GenerationCost = {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: string;
};

/** Cuántos ítems de qué tipo y destreza hacen falta para una sección del examen. */
export interface ExamItemRequest {
  skill: string;
  type: string;
  count: number;
}

export interface GeneratedExamItem {
  type: string;
  skill: string;
  prompt: Record<string, unknown>;
  /** Ausente en los tipos que se corrigen con rúbrica (`written_production`, `spoken_production`). */
  solution?: Record<string, unknown>;
}

/**
 * Puerto de generación de exámenes con IA, propio de `assessment` — no el
 * `ContentGeneratorPort` de `learning`, que este contexto no puede importar
 * (`ARCHITECTURE.md`). Genera VARIANTES del contenido enseñado, nunca los
 * ejercicios de práctica ya existentes: `avoidPrompts` es la lista de
 * enunciados que ya se usaron en práctica, para que el modelo no los repita
 * literalmente («un examen mide lo aprendido, no la memoria del enunciado
 * exacto»).
 */
export interface ExamGeneratorPort {
  generateItems(params: {
    language: string;
    level: string;
    /** Temas de las unidades de origen, para que las variantes examinen el mismo contenido. */
    topics: readonly string[];
    items: readonly ExamItemRequest[];
    avoidPrompts: readonly Record<string, unknown>[];
  }): Promise<{ items: GeneratedExamItem[]; cost: GenerationCost }>;
}

export const EXAM_GENERATOR_PORT = Symbol("ExamGeneratorPort");
