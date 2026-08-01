/**
 * Coste real de una llamada al modelo. Se devuelve SIEMPRE que se llama al
 * proveedor —también cuando la generación termina en fallo tras el
 * reintento—: el proveedor cobra la llamada se valide o no la salida, y sin
 * este dato no hay fila que registrar en `ai_generations` (regla de la ola 2:
 * «el coste se registra antes de descontar créditos»). Ver
 * `ContentGenerationFailedError` en el adaptador, que lo transporta incluso
 * cuando lanza.
 */
export type GenerationCost = {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: string;
};

/**
 * Puerto de generación de contenido con IA para `learning`.
 *
 * El dominio no sabe qué modelo lo implementa, ni cómo se le pide la salida,
 * ni cómo se calcula el coste: solo pide contenido y recibe, junto a él, lo
 * que costó producirlo. Cada método devuelve el `cost` en el mismo objeto que
 * el contenido —nunca por separado— para que sea imposible generar sin que el
 * llamante tenga el coste a mano: pedirlo aparte abriría la puerta a
 * descontar contenido sin cobrarlo.
 *
 * El adaptador (infraestructura) decide el proveedor, el modelo, el
 * reintento con el error como contexto y la validación de esquema; aquí no
 * hay ni un nombre de proveedor.
 */
export interface ContentGeneratorPort {
  /**
   * Genera el cuerpo de una unidad. Devuelve el contenido Y su coste: el
   * dominio necesita el segundo para descontar créditos, y pedirlo por
   * separado abriría la puerta a generar sin cobrar.
   */
  generateUnit(params: {
    language: string;
    level: string;
    topic: string;
    skills: string[];
    locale: string;
    sourceMaterial?: string;
  }): Promise<{ title: string; description: string; body: string; cost: GenerationCost }>;

  generateExercises(params: {
    unitBody: string;
    language: string;
    level: string;
    types: string[];
    count: number;
  }): Promise<{ exercises: unknown[]; cost: GenerationCost }>;

  correctWriting(params: {
    task: string;
    response: string;
    rubric: { criteria: Array<{ key: string; label: string; descriptors: string[] }> };
    language: string;
    level: string;
  }): Promise<{ score: number; feedback: string; byCriterion: Record<string, number>; cost: GenerationCost }>;
}

export const CONTENT_GENERATOR_PORT = Symbol("ContentGeneratorPort");
