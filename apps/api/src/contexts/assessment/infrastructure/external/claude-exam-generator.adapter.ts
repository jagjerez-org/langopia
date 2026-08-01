import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateExamItem } from "../../domain/model/exam-item-schemas.js";
import type {
  ExamGeneratorPort,
  ExamItemRequest,
  GeneratedExamItem,
  GenerationCost,
} from "../../domain/ports/exam-generator.port.js";
import { buildExamGenerationPrompt, examGenerationOutputSchema } from "./prompts/exam-generation.prompt.js";
import { buildRetryPrompt } from "./prompts/retry-with-error.prompt.js";

/** Un único reintento (regla de la ola 2): si el segundo también falla, no hay un tercero. */
const MAX_ATTEMPTS = 2;

/** Modelo por defecto si `ANTHROPIC_MODEL` no está configurado. Tomado de la skill `claude-api` (no de memoria). */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * Tarifa en dólares por millón de tokens, tomada de la skill `claude-api`
 * (no de memoria). Misma tabla que `ClaudeContentGeneratorAdapter`
 * (`learning`) y `ClaudeWritingCorrectorAdapter` (`assessment`): son datos
 * del proveedor, no del dominio de ninguno de los tres, así que coinciden
 * a propósito.
 */
const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

const EXAM_MAX_TOKENS = 6000;

/**
 * Sin `ANTHROPIC_API_KEY` no hay forma de generar un examen en este
 * entorno. El camino falla limpio y pronto, antes de construir ningún
 * cliente ni de intentar ninguna llamada.
 */
export class MissingAnthropicApiKeyError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY: no se puede generar un examen con IA en este entorno.");
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
 * La generación no produjo una salida válida tras el reintento: el examen
 * no llega al alumnado. Quien la lance (`generate-exam.handler`) marca la
 * generación `failed` y no cobra créditos por ella — pero el coste real sí
 * se conoce y viaja en `cost`, porque el proveedor cobró la llamada igual.
 */
export class ExamGenerationFailedError extends Error {
  constructor(
    message: string,
    readonly cost: GenerationCost,
  ) {
    super(message);
    this.name = "ExamGenerationFailedError";
  }
}

type ExactCost = { inputTokens: number; outputTokens: number; costCentsExact: number; model: string };

type AttemptOutcome =
  | { ok: true; items: GeneratedExamItem[]; cost: ExactCost }
  | { ok: false; reason: string; invalidOutput: unknown; cost: ExactCost };

/**
 * Adaptador de `ExamGeneratorPort` sobre la API de Anthropic.
 *
 * Mismo patrón que `ClaudeContentGeneratorAdapter` (`learning`): salida
 * estructurada (`zodOutputFormat`), un reintento con el error de validación
 * como contexto, y `validateExamItem` (`domain/model/exam-item-schemas.ts`)
 * como la única puerta real entre lo que devuelve el modelo y lo que llega
 * al alumnado — este adaptador no la duplica, solo la invoca.
 */
@Injectable()
export class ClaudeExamGeneratorAdapter implements ExamGeneratorPort {
  constructor(private readonly config: ConfigService) {}

  async generateItems(params: {
    language: string;
    level: string;
    topics: readonly string[];
    items: readonly ExamItemRequest[];
    avoidPrompts: readonly Record<string, unknown>[];
  }): Promise<{ items: GeneratedExamItem[]; cost: GenerationCost }> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const client = this.createClient(apiKey);
    const { system, user } = buildExamGenerationPrompt(params);

    const attempt = async (userPrompt: string): Promise<AttemptOutcome> => {
      const response = await client.messages.parse({
        model,
        max_tokens: EXAM_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: zodOutputFormat(examGenerationOutputSchema) },
      });
      const cost = this.computeCost(model, response.usage);

      if (response.stop_reason === "refusal") {
        return { ok: false, reason: "el modelo rechazó la petición por política de contenido.", invalidOutput: null, cost };
      }
      if (response.parsed_output === null) {
        return { ok: false, reason: "la respuesta no tiene la forma JSON esperada.", invalidOutput: null, cost };
      }

      try {
        for (const raw of response.parsed_output.items) {
          validateExamItem(raw.type, raw.prompt, raw.solution);
        }
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
          invalidOutput: response.parsed_output,
          cost,
        };
      }

      return { ok: true, items: response.parsed_output.items as GeneratedExamItem[], cost };
    };

    const first = await attempt(user);
    if (first.ok) return { items: first.items, cost: this.finalizeCost(first.cost) };

    const retryPrompt = buildRetryPrompt(user, first.invalidOutput, first.reason);
    const second = await attempt(retryPrompt);
    const totalCost = this.sumCosts(first.cost, second.cost);
    if (second.ok) return { items: second.items, cost: this.finalizeCost(totalCost) };

    throw new ExamGenerationFailedError(
      `La generación del examen no produjo una salida válida tras ${MAX_ATTEMPTS} intentos: ${second.reason}`,
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
