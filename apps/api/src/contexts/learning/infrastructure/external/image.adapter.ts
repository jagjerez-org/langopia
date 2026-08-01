import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type { MediaGenerationCost, StoredMediaAsset } from "../../domain/ports/media-generator.port.js";
import { MissingAnthropicApiKeyError, UnknownModelPricingError } from "./claude-content-generator.adapter.js";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";

const IMAGE_MIME_TYPE = "image/png";
/** Coste provisional en céntimos por imagen, mientras no hay un proveedor de imagen real conectado. */
const DEFAULT_IMAGE_COST_CENTS = 4;

/** Modelo por defecto para traducir el texto alternativo, coherente con `ClaudeContentGeneratorAdapter`. */
const DEFAULT_TRANSLATION_MODEL = "claude-opus-5";
const MAX_TRANSLATION_ATTEMPTS = 2;
const TRANSLATION_MAX_TOKENS = 1024;

/**
 * Tarifa en dólares por millón de tokens, tomada de la skill `claude-api` (no
 * de memoria) — la misma tabla que usa `ClaudeContentGeneratorAdapter`, no
 * importada de allí porque es privada a ese fichero (cada adaptador es dueño
 * de su propio coste, igual que cada uno decide su propio modelo).
 */
const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

/**
 * Sin `IMAGE_PROVIDER_API_KEY` ni `IMAGE_PROVIDER_ENDPOINT` no hay forma de
 * generar imágenes en este entorno. Falla limpio y pronto, antes de tocar el
 * proveedor de imagen o el de traducción.
 */
export class MissingImageProviderCredentialsError extends Error {
  constructor() {
    super("Faltan IMAGE_PROVIDER_API_KEY o IMAGE_PROVIDER_ENDPOINT: no se puede generar la imagen en este entorno.");
    this.name = "MissingImageProviderCredentialsError";
  }
}

/**
 * La imagen se generó (y se cobró), pero el texto alternativo no se pudo
 * producir en todos los idiomas de la escuela tras el reintento. `cost`
 * lleva SIEMPRE lo gastado de verdad —la imagen del proveedor, más la
 * traducción que sí se llegó a pagar—, para que no haya generación sin
 * coste registrado aunque falle.
 */
export class ImageGenerationFailedError extends Error {
  constructor(
    message: string,
    readonly cost: MediaGenerationCost,
  ) {
    super(message);
    this.name = "ImageGenerationFailedError";
  }
}

const altTextOutputSchema = (locales: string[]) =>
  z.object(Object.fromEntries(locales.map((locale) => [locale, z.string().min(1)])));

type ImageResult = StoredMediaAsset & { altText: Record<string, string>; cost: MediaGenerationCost };

/**
 * Adaptador de imagen: implementa la parte de imagen de `MediaGeneratorPort`
 * (`generateImage`). `TtsAdapter`, en el fichero hermano, implementa la de
 * audio; ver el informe de la tarea para por qué son dos clases.
 *
 * El texto alternativo se traduce a partir del propio `prompt` —la
 * descripción que ya sirvió para pedir la imagen— en vez de volver a
 * describir la imagen generada con visión: el modelo ya sabe qué le pedimos
 * dibujar, así que esa descripción es una base fiel para el texto
 * alternativo en cada idioma de la escuela, y evita una segunda llamada de
 * visión solo para eso. La traducción usa Anthropic (`ANTHROPIC_API_KEY`),
 * el mismo proveedor que el resto de la ola para todo lo que es texto; el
 * proveedor de imagen en sí es un HTTP genérico, pendiente del que se
 * conecte de verdad (ver el informe).
 */
@Injectable()
export class ImageAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: ContentAssetStorageAdapter,
  ) {}

  async generateImage(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    prompt: string;
    sourceLocale: string;
    targetLocales: string[];
  }): Promise<ImageResult> {
    const imageCredentials = this.requireImageCredentials();
    const anthropicApiKey = this.requireAnthropicApiKey();

    const image = await this.generateImageBytes(params.prompt, imageCredentials);
    const imageCostCents = image.costCents ?? this.defaultImageCostCents();

    const { altText, cost: translationCost } = await this.translateAltText(
      { prompt: params.prompt, sourceLocale: params.sourceLocale, targetLocales: params.targetLocales },
      anthropicApiKey,
      imageCostCents,
    );

    const stored = await this.storage.store({
      schoolKey: params.schoolKey,
      unitCode: params.unitCode,
      kind: "image",
      sequence: params.sequence,
      body: image.bytes,
      contentType: image.mimeType,
    });

    return {
      ...stored,
      altText,
      cost: {
        unitsProduced: 1,
        costCents: Math.round(imageCostCents + translationCost.costCentsExact),
        model: translationCost.model,
      },
    };
  }

  /**
   * Traduce `prompt` a todos los `targetLocales`: la entrada de `sourceLocale`
   * (si está entre ellos) es el propio `prompt`, sin gastar una llamada en
   * "traducir" un idioma al que ya está escrito. Reintenta una vez con el
   * error como contexto si falta algún idioma o el modelo rechaza la
   * petición; si el segundo intento también falla, lanza
   * `ImageGenerationFailedError` con el coste de la imagen más el de los
   * intentos de traducción que sí se pagaron —el proveedor cobra la llamada
   * se valide o no la salida—.
   */
  private async translateAltText(
    params: { prompt: string; sourceLocale: string; targetLocales: string[] },
    apiKey: string,
    imageCostCentsAlreadySpent: number,
  ): Promise<{ altText: Record<string, string>; cost: { costCentsExact: number; model: string } }> {
    const localesToTranslate = params.targetLocales.filter((locale) => locale !== params.sourceLocale);
    const model = this.resolveTranslationModel();
    const client = this.createClient(apiKey);

    if (localesToTranslate.length === 0) {
      return {
        altText: Object.fromEntries(params.targetLocales.map((locale) => [locale, params.prompt])),
        cost: { costCentsExact: 0, model },
      };
    }

    const schema = altTextOutputSchema(localesToTranslate);
    let totalCostCentsExact = 0;
    let lastReason = "";

    for (let attempt = 1; attempt <= MAX_TRANSLATION_ATTEMPTS; attempt++) {
      const retryContext =
        attempt === 1
          ? ""
          : `\n\nEl intento anterior no valió: ${lastReason}. Corrígelo y responde de nuevo con TODOS los idiomas pedidos.`;
      const response = await client.messages.parse({
        model,
        max_tokens: TRANSLATION_MAX_TOKENS,
        system:
          "Traduces texto alternativo de accesibilidad para material didáctico de idiomas. " +
          "Traduce con fidelidad, en una frase breve y natural, sin añadir ni quitar información.",
        messages: [
          {
            role: "user",
            content:
              `Traduce esta descripción de imagen (en «${params.sourceLocale}») a cada uno de estos idiomas: ` +
              `${localesToTranslate.join(", ")}.\n\nDescripción: ${params.prompt}${retryContext}`,
          },
        ],
        output_config: { format: zodOutputFormat(schema) },
      });

      totalCostCentsExact += this.computeCostCentsExact(model, response.usage);

      if (response.stop_reason === "refusal" || response.parsed_output === null) {
        lastReason =
          response.stop_reason === "refusal"
            ? "el modelo rechazó la petición por política de contenido."
            : "la respuesta no tiene la forma JSON esperada.";
        continue;
      }

      const parsed = response.parsed_output as Record<string, string>;
      const missing = localesToTranslate.filter((locale) => !parsed[locale]);
      if (missing.length > 0) {
        lastReason = `faltan traducciones para: ${missing.join(", ")}.`;
        continue;
      }

      return {
        altText: {
          ...parsed,
          ...(params.targetLocales.includes(params.sourceLocale) ? { [params.sourceLocale]: params.prompt } : {}),
        },
        cost: { costCentsExact: totalCostCentsExact, model },
      };
    }

    throw new ImageGenerationFailedError(
      `El texto alternativo no se produjo en todos los idiomas de la escuela tras ${MAX_TRANSLATION_ATTEMPTS} intentos: ${lastReason}`,
      {
        unitsProduced: 1,
        costCents: Math.round(imageCostCentsAlreadySpent + totalCostCentsExact),
        model,
      },
    );
  }

  private computeCostCentsExact(model: string, usage: { input_tokens: number; output_tokens: number }): number {
    const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
    if (!pricing) throw new UnknownModelPricingError(model);
    const inputCostUsd = (usage.input_tokens / 1_000_000) * pricing.input;
    const outputCostUsd = (usage.output_tokens / 1_000_000) * pricing.output;
    return (inputCostUsd + outputCostUsd) * 100;
  }

  private resolveTranslationModel(): string {
    return this.config.get<string>("ANTHROPIC_MODEL") ?? DEFAULT_TRANSLATION_MODEL;
  }

  private defaultImageCostCents(): number {
    return this.config.get<number>("IMAGE_COST_CENTS_PER_IMAGE") ?? DEFAULT_IMAGE_COST_CENTS;
  }

  private requireImageCredentials(): { apiKey: string; endpoint: string } {
    const apiKey = this.config.get<string>("IMAGE_PROVIDER_API_KEY");
    const endpoint = this.config.get<string>("IMAGE_PROVIDER_ENDPOINT");
    if (!apiKey || !endpoint) throw new MissingImageProviderCredentialsError();
    return { apiKey, endpoint };
  }

  private requireAnthropicApiKey(): string {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) throw new MissingAnthropicApiKeyError();
    return apiKey;
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del proveedor de imagen sin tocar la lógica. */
  protected async generateImageBytes(
    prompt: string,
    credentials: { apiKey: string; endpoint: string },
  ): Promise<{ bytes: Buffer; mimeType: string; costCents?: number }> {
    const response = await fetch(credentials.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${credentials.apiKey}` },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      throw new Error(`El proveedor de imagen respondió ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as { image_base64: string; mime_type?: string; cost_cents?: number };
    return {
      bytes: Buffer.from(payload.image_base64, "base64"),
      mimeType: payload.mime_type ?? IMAGE_MIME_TYPE,
      costCents: payload.cost_cents,
    };
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del SDK de Anthropic. */
  protected createClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }
}
