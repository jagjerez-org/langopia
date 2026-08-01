import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type {
  TranscriptSummarizerPort,
  TranscriptSummaryResult,
} from "../../domain/ports/transcript-summarizer.port.js";

const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 2048;
const CENTS_PER_CREDIT = 10;

const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

const transcriptSummarySchema = z.object({
  summary: z.string().min(20),
  vocabulary: z
    .array(
      z.object({
        term: z.string().min(1),
        lemma: z.string().min(1).optional(),
        level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
        count: z.number().int().positive(),
      }),
    )
    .max(20),
  recurringErrors: z
    .array(
      z.object({
        pattern: z.string().min(1),
        suggestion: z.string().min(1),
        count: z.number().int().positive(),
      }),
    )
    .max(10),
});

export class MissingTranscriptSummarizerCredentialsError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY: no se puede resumir la transcripción en este entorno.");
    this.name = "MissingTranscriptSummarizerCredentialsError";
  }
}

export class TranscriptSummaryFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptSummaryFailedError";
  }
}

@Injectable()
export class ClaudeTranscriptSummarizerAdapter implements TranscriptSummarizerPort {
  constructor(private readonly config: ConfigService) {}

  async summarizeClass(params: {
    transcriptId: string;
    sessionId: string;
    language: string;
    segments: readonly {
      startMs: number;
      endMs: number;
      text: string;
      speakerLabel: string | null;
      isTeacher: boolean;
    }[];
  }): Promise<TranscriptSummaryResult> {
    const apiKey = this.requireApiKey();
    const model = this.resolveModel();
    const response = await this.createClient(apiKey).messages.parse({
      model,
      max_tokens: MAX_TOKENS,
      system:
        "Eres un asistente pedagógico para academias de idiomas. Resume clases, extrae vocabulario útil " +
        "con nivel MCER y detecta errores recurrentes accionables para el profesor. Responde siempre " +
        "en JSON estructurado conforme al esquema.",
      messages: [{ role: "user", content: buildPrompt(params) }],
      output_config: { format: zodOutputFormat(transcriptSummarySchema) },
    });

    if (response.stop_reason === "refusal" || response.parsed_output === null) {
      throw new TranscriptSummaryFailedError("El modelo no devolvió un resumen estructurado válido.");
    }

    const costCents = computeCostCents(model, response.usage);
    return {
      summary: response.parsed_output.summary,
      vocabulary: response.parsed_output.vocabulary,
      recurringErrors: response.parsed_output.recurringErrors,
      cost: {
        costCents,
        creditsCharged: Math.max(0, Math.round(costCents / CENTS_PER_CREDIT)),
      },
    };
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) throw new MissingTranscriptSummarizerCredentialsError();
    return apiKey;
  }

  private resolveModel(): string {
    return this.config.get<string>("ANTHROPIC_MODEL") ?? DEFAULT_MODEL;
  }

  protected createClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }
}

function buildPrompt(params: {
  transcriptId: string;
  sessionId: string;
  language: string;
  segments: readonly {
    startMs: number;
    endMs: number;
    text: string;
    speakerLabel: string | null;
    isTeacher: boolean;
  }[];
}): string {
  const transcript = params.segments
    .map((segment) => {
      const speaker = segment.isTeacher ? "Profesor" : segment.speakerLabel ?? "Alumno";
      return `[${segment.startMs}-${segment.endMs} ms] ${speaker}: ${segment.text}`;
    })
    .join("\n");

  return [
    `Transcripción: ${params.transcriptId}`,
    `Clase: ${params.sessionId}`,
    `Idioma: ${params.language}`,
    "",
    "Devuelve:",
    "- summary: resumen para el profesor, con próximos pasos.",
    "- vocabulary: términos o expresiones útiles, con lemma si procede, nivel MCER y frecuencia.",
    "- recurringErrors: patrones de error repetidos y sugerencia concreta para la siguiente sesión.",
    "",
    transcript,
  ].join("\n");
}

function computeCostCents(model: string, usage: { input_tokens: number; output_tokens: number }): number {
  const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
  if (!pricing) throw new TranscriptSummaryFailedError(`No hay tarifa conocida para el modelo «${model}».`);
  const inputCostUsd = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCostUsd = (usage.output_tokens / 1_000_000) * pricing.output;
  return Math.round((inputCostUsd + outputCostUsd) * 100);
}
