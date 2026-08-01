import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RubricCriterion } from "../../domain/model/rubric.vo.js";
import type { CorrectionCost, WritingCorrectorPort } from "../../domain/ports/writing-corrector.port.js";
import { buildWritingCorrectionPrompt, writingCorrectionOutputSchema } from "./prompts/writing-correction.prompt.js";

/**
 * Modelo por defecto si `ANTHROPIC_MODEL` no está configurado. Tomado de la
 * skill `claude-api` (no de memoria).
 */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * Tarifa en dólares por millón de tokens, tomada de la skill `claude-api`
 * (no de memoria). Misma tabla que `ClaudeContentGeneratorAdapter`
 * (`learning`): son datos del proveedor, no del dominio de ninguno de los
 * dos contextos, así que coinciden a propósito.
 */
const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

const CORRECTION_MAX_TOKENS = 2048;

/**
 * Sin `ANTHROPIC_API_KEY` no hay forma de corregir con IA en este entorno.
 * El camino falla limpio y pronto en vez de fallar tarde con un error de red.
 */
export class MissingAnthropicApiKeyError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY: no se puede corregir con IA en este entorno.");
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
 * La corrección no produjo una salida válida (rechazo del modelo, JSON que
 * no cumple el esquema, o criterios que no coinciden con la rúbrica).
 */
export class WritingCorrectionFailedError extends Error {
  constructor(
    message: string,
    readonly cost: CorrectionCost,
  ) {
    super(message);
    this.name = "WritingCorrectionFailedError";
  }
}

/**
 * Adaptador de `WritingCorrectorPort` sobre la API de Anthropic.
 *
 * A diferencia de `ClaudeContentGeneratorAdapter` (`learning`), un único
 * intento, sin reintento con el error como contexto: si la corrección falla,
 * el intento del alumno se queda en `submitted` y el profesor lo valida
 * directamente (`Attempt.validate()` lo admite desde ahí) — hay una red de
 * seguridad pedagógica que la generación de contenido no tiene (un ejercicio
 * que no valida no tiene ningún profesor de respaldo). Igual que allí, salida
 * estructurada (`output_config.format` vía `zodOutputFormat`): no se parsea
 * texto libre.
 */
@Injectable()
export class ClaudeWritingCorrectorAdapter implements WritingCorrectorPort {
  constructor(private readonly config: ConfigService) {}

  async correct(params: {
    task: string;
    response: string;
    rubric: { criteria: readonly RubricCriterion[] };
    language: string;
    level: string;
  }): Promise<{ feedback: string; byCriterion: Record<string, number>; cost: CorrectionCost }> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const client = this.createClient(apiKey);
    const { system, user } = buildWritingCorrectionPrompt(params);

    const response = await client.messages.parse({
      model,
      max_tokens: CORRECTION_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(writingCorrectionOutputSchema) },
    });

    const cost = this.computeCost(model, response.usage);

    if (response.stop_reason === "refusal") {
      throw new WritingCorrectionFailedError(
        "el modelo rechazó la petición por política de contenido.",
        cost,
      );
    }
    if (response.parsed_output === null) {
      throw new WritingCorrectionFailedError("la respuesta no tiene la forma JSON esperada.", cost);
    }

    // No se comprueba aquí que `byCriterion` traiga exactamente los criterios
    // de la rúbrica: `Rubric.weightedScore` (dominio) ya lo hace —
    // `RubricScoreMismatchError`— y es quien conoce el código de la rúbrica
    // para el mensaje. Este adaptador no lo duplica.
    return { feedback: response.parsed_output.feedback, byCriterion: response.parsed_output.byCriterion, cost };
  }

  private computeCost(model: string, usage: { input_tokens: number; output_tokens: number }): CorrectionCost {
    const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
    if (!pricing) throw new UnknownModelPricingError(model);
    const inputCostUsd = (usage.input_tokens / 1_000_000) * pricing.input;
    const outputCostUsd = (usage.output_tokens / 1_000_000) * pricing.output;
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      costCents: Math.round((inputCostUsd + outputCostUsd) * 100),
      model,
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
