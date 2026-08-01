import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { z } from "zod";
import { validateExercise, type ExerciseType } from "../../domain/model/exercise-schemas.js";
import type { ContentGeneratorPort, GenerationCost } from "../../domain/ports/content-generator.port.js";
import { buildExerciseGenerationPrompt, exerciseGenerationOutputSchema } from "./prompts/exercise-generation.prompt.js";
import { buildRetryPrompt } from "./prompts/retry-with-error.prompt.js";
import { buildUnitGenerationPrompt, unitGenerationOutputSchema } from "./prompts/unit-generation.prompt.js";
import { buildWritingCorrectionPrompt, writingCorrectionOutputSchema } from "./prompts/writing-correction.prompt.js";

/** Un único reintento (regla de la ola 2): si el segundo también falla, no hay un tercero. */
const MAX_ATTEMPTS = 2;

/**
 * Modelo por defecto si `ANTHROPIC_MODEL` no está configurado. Tomado de la
 * skill `claude-api` (no de memoria): es el modelo recomendado salvo que se
 * pida explícitamente otro.
 */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * Tarifa en dólares por millón de tokens, tomada de la skill `claude-api`
 * (no de memoria) para los tres modelos que `ANTHROPIC_MODEL` puede
 * seleccionar hoy. Si el día de mañana se añade un modelo nuevo a la lista,
 * esta tabla es lo único que hay que tocar para poder facturarlo.
 */
const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

const UNIT_MAX_TOKENS = 4096;
const EXERCISES_MAX_TOKENS = 6000;
const CORRECTION_MAX_TOKENS = 2048;

/**
 * Sin `ANTHROPIC_API_KEY` no hay forma de generar contenido en este entorno.
 * El camino falla limpio y pronto —antes de construir ningún cliente ni de
 * intentar ninguna llamada— en vez de fallar tarde con un error de red o de
 * autenticación más difícil de diagnosticar.
 */
export class MissingAnthropicApiKeyError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY: no se puede generar contenido con IA en este entorno.");
    this.name = "MissingAnthropicApiKeyError";
  }
}

/** `ANTHROPIC_MODEL` apunta a un modelo sin tarifa conocida: no hay forma de calcular su coste. */
export class UnknownModelPricingError extends Error {
  constructor(model: string) {
    super(`No hay tarifa conocida para el modelo «${model}»: no se puede calcular su coste.`);
    this.name = "UnknownModelPricingError";
  }
}

/**
 * La generación falló dos veces seguidas (la primera, y el reintento con el
 * error como contexto): la unidad o el conjunto de ejercicios no llega al
 * alumnado. Quien la lance (el futuro caso de uso) marca la generación
 * `failed` y NO cobra créditos por ella —pero el coste real sí se conoce y
 * viaja en `cost`, porque el proveedor cobró la llamada igual: sin este dato
 * no hay forma de vigilar el margen de las generaciones que fallan.
 */
export class ContentGenerationFailedError extends Error {
  constructor(
    message: string,
    readonly cost: GenerationCost,
  ) {
    super(message);
    this.name = "ContentGenerationFailedError";
  }
}

/**
 * Coste sin redondear, para poder sumar dos intentos SIN arrastrar el
 * redondeo de cada uno por separado. Redondear cada intento a céntimos y
 * sumar después habría inflado el coste del reintento (dos intentos de
 * medio céntimo redondean a 1+1=2, cuando el gasto real es 1); aquí solo se
 * redondea una vez, al final, sobre el total exacto.
 */
type ExactCost = { inputTokens: number; outputTokens: number; costCentsExact: number; model: string };

type AttemptOutcome<T> =
  | { ok: true; parsed: T; cost: ExactCost }
  | { ok: false; reason: string; invalidOutput: unknown; cost: ExactCost };

/**
 * Adaptador de `ContentGeneratorPort` sobre la API de Anthropic.
 *
 * - **Salida estructurada** (`output_config.format` vía `zodOutputFormat`)
 *   contra el esquema de cada método: no se parsea texto libre.
 * - **Un reintento** con el error de validación como contexto si la primera
 *   salida no vale (`buildRetryPrompt`); si el segundo intento tampoco vale,
 *   lanza `ContentGenerationFailedError` con el coste acumulado de ambos
 *   intentos —el proveedor cobra los dos, valga o no la salida—.
 * - `generateExercises` reutiliza `validateExercise`
 *   (`domain/model/exercise-schemas.ts`, tarea 2) para la forma propia de
 *   cada uno de los once tipos: esa es la red de seguridad real, y este
 *   adaptador no la duplica, solo la invoca.
 */
@Injectable()
export class ClaudeContentGeneratorAdapter implements ContentGeneratorPort {
  constructor(private readonly config: ConfigService) {}

  async generateUnit(params: {
    language: string;
    level: string;
    topic: string;
    skills: string[];
    locale: string;
    sourceMaterial?: string;
  }): Promise<{ title: string; description: string; body: string; cost: GenerationCost }> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const client = this.createClient(apiKey);
    const { system, user } = buildUnitGenerationPrompt(params);

    const { parsed, cost } = await this.runWithRetry({
      client,
      model,
      maxTokens: UNIT_MAX_TOKENS,
      system,
      userPrompt: user,
      schema: unitGenerationOutputSchema,
      // El esquema (tres cadenas no vacías) ya cubre la única regla de esta
      // forma; no hay ninguna invariante cruzada adicional que comprobar,
      // a diferencia de los ejercicios o la corrección de escritura.
      validateBusinessRules: () => undefined,
    });

    return { title: parsed.title, description: parsed.description, body: parsed.body, cost };
  }

  async generateExercises(params: {
    unitBody: string;
    language: string;
    level: string;
    types: string[];
    count: number;
  }): Promise<{ exercises: unknown[]; cost: GenerationCost }> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const client = this.createClient(apiKey);
    const { system, user } = buildExerciseGenerationPrompt(params);

    const { parsed, cost } = await this.runWithRetry({
      client,
      model,
      maxTokens: EXERCISES_MAX_TOKENS,
      system,
      userPrompt: user,
      schema: exerciseGenerationOutputSchema,
      // La única puerta real: un ejercicio que no valida no llega nunca al
      // alumnado. `validateExercise` ya conoce la forma propia (`prompt`/
      // `solution`) de cada uno de los once tipos; no se repite aquí.
      validateBusinessRules: (output) => {
        for (const exercise of output.exercises) {
          validateExercise(exercise.type as ExerciseType, exercise.prompt, exercise.solution);
        }
      },
    });

    return { exercises: parsed.exercises, cost };
  }

  async correctWriting(params: {
    task: string;
    response: string;
    rubric: { criteria: Array<{ key: string; label: string; descriptors: string[] }> };
    language: string;
    level: string;
  }): Promise<{ score: number; feedback: string; byCriterion: Record<string, number>; cost: GenerationCost }> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const client = this.createClient(apiKey);
    const { system, user } = buildWritingCorrectionPrompt(params);
    const expectedCriteria = new Set(params.rubric.criteria.map((c) => c.key));

    const { parsed, cost } = await this.runWithRetry({
      client,
      model,
      maxTokens: CORRECTION_MAX_TOKENS,
      system,
      userPrompt: user,
      schema: writingCorrectionOutputSchema,
      // `byCriterion` tiene que traer EXACTAMENTE los criterios de la
      // rúbrica de esta llamada: ni un criterio inventado, ni uno omitido.
      // No es una regla que el esquema genérico pueda expresar (no conoce la
      // rúbrica concreta), así que se comprueba aquí.
      validateBusinessRules: (output) => {
        const receivedCriteria = new Set(Object.keys(output.byCriterion));
        const sameCriteria =
          receivedCriteria.size === expectedCriteria.size &&
          [...expectedCriteria].every((key) => receivedCriteria.has(key));
        if (!sameCriteria) {
          throw new Error(
            `\`byCriterion\` debe traer exactamente una entrada por cada criterio de la rúbrica ` +
              `(${[...expectedCriteria].join(", ")}), y trae (${[...receivedCriteria].join(", ")}).`,
          );
        }
      },
    });

    return { score: parsed.score, feedback: parsed.feedback, byCriterion: parsed.byCriterion, cost };
  }

  /**
   * Un intento de salida estructurada + validación de negocio, con un
   * reintento si falla. Nunca se traga el fallo del segundo intento: lanza
   * `ContentGenerationFailedError` con el coste de ambos ya sumado.
   */
  private async runWithRetry<T>(args: {
    client: Anthropic;
    model: string;
    maxTokens: number;
    system: string;
    userPrompt: string;
    schema: z.ZodType<T>;
    validateBusinessRules: (parsed: T) => void;
  }): Promise<{ parsed: T; cost: GenerationCost }> {
    const attempt = async (userPrompt: string): Promise<AttemptOutcome<T>> => {
      const response = await args.client.messages.parse({
        model: args.model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: zodOutputFormat(args.schema) },
      });
      const cost = this.computeCost(args.model, response.usage);

      if (response.stop_reason === "refusal") {
        return {
          ok: false,
          reason: "el modelo rechazó la petición por política de contenido.",
          invalidOutput: null,
          cost,
        };
      }
      if (response.parsed_output === null) {
        return {
          ok: false,
          reason: "la respuesta no tiene la forma JSON esperada.",
          invalidOutput: null,
          cost,
        };
      }
      try {
        args.validateBusinessRules(response.parsed_output);
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
          invalidOutput: response.parsed_output,
          cost,
        };
      }
      return { ok: true, parsed: response.parsed_output, cost };
    };

    const first = await attempt(args.userPrompt);
    if (first.ok) return { parsed: first.parsed, cost: this.finalizeCost(first.cost) };

    const retryPrompt = buildRetryPrompt(args.userPrompt, first.invalidOutput, first.reason);
    const second = await attempt(retryPrompt);
    const totalCost = this.sumCosts(first.cost, second.cost);
    if (second.ok) return { parsed: second.parsed, cost: this.finalizeCost(totalCost) };

    throw new ContentGenerationFailedError(
      `La generación no produjo una salida válida tras ${MAX_ATTEMPTS} intentos: ${second.reason}`,
      this.finalizeCost(totalCost),
    );
  }

  private computeCost(model: string, usage: { input_tokens: number; output_tokens: number }): ExactCost {
    const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
    if (!pricing) throw new UnknownModelPricingError(model);
    const inputCostUsd = (usage.input_tokens / 1_000_000) * pricing.input;
    const outputCostUsd = (usage.output_tokens / 1_000_000) * pricing.output;
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      costCentsExact: (inputCostUsd + outputCostUsd) * 100,
      model,
    };
  }

  private sumCosts(a: ExactCost, b: ExactCost): ExactCost {
    return {
      inputTokens: a.inputTokens + b.inputTokens,
      outputTokens: a.outputTokens + b.outputTokens,
      costCentsExact: a.costCentsExact + b.costCentsExact,
      model: a.model,
    };
  }

  /** Único punto donde el coste exacto se redondea a céntimos, ya con todos los intentos sumados. */
  private finalizeCost(cost: ExactCost): GenerationCost {
    return {
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
      costCents: Math.round(cost.costCentsExact),
      model: cost.model,
    };
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) throw new MissingAnthropicApiKeyError();
    return apiKey;
  }

  private resolveModel(): string {
    return this.config.get<string>("ANTHROPIC_MODEL") ?? DEFAULT_MODEL;
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del SDK sin tocar la lógica. */
  protected createClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }
}
