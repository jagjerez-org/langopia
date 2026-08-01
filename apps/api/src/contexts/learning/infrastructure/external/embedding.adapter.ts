import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EmbeddingProviderPort } from "../../domain/ports/embedding-provider.port.js";

/**
 * Dimensión de los vectores que produce este adaptador. Tiene que coincidir
 * con `MATERIAL_EMBEDDING_DIMENSIONS` de
 * `packages/db/src/schema/content.ts` (la columna `vector(n)` de
 * `content_material_chunks`) — un desajuste no pasa desapercibido: falla
 * alto, en `embed()`, antes de intentar ningún `INSERT`.
 */
export const MATERIAL_EMBEDDING_DIMENSIONS = 1024;

const DEFAULT_EMBEDDING_MODEL = "voyage-3";

/**
 * Sin `EMBEDDING_PROVIDER_API_KEY`/`EMBEDDING_PROVIDER_ENDPOINT` no hay
 * forma de indexar material en este entorno. Falla limpio y pronto, antes de
 * trocear ni de intentar ninguna llamada — mismo criterio que
 * `MissingTtsCredentialsError`/`MissingImageProviderCredentialsError`.
 */
export class MissingEmbeddingProviderCredentialsError extends Error {
  constructor() {
    super(
      "Faltan EMBEDDING_PROVIDER_API_KEY o EMBEDDING_PROVIDER_ENDPOINT: no se puede indexar " +
        "material propio en este entorno.",
    );
    this.name = "MissingEmbeddingProviderCredentialsError";
  }
}

/**
 * Un vector que no trae exactamente `MATERIAL_EMBEDDING_DIMENSIONS`
 * componentes no se puede guardar en `content_material_chunks` — mejor un
 * mensaje propio y claro aquí que un error crudo de Postgres al insertar.
 */
export class EmbeddingDimensionMismatchError extends Error {
  constructor(expected: number, actual: number) {
    super(
      `El proveedor de embeddings devolvió un vector de ${actual} dimensiones; se esperaban ${expected}.`,
    );
    this.name = "EmbeddingDimensionMismatchError";
  }
}

/**
 * Adaptador de embeddings de texto.
 *
 * Anthropic no ofrece un endpoint de embeddings propio (a diferencia de
 * texto o visión): la recomendación oficial es un proveedor especializado
 * como Voyage AI. Sin credenciales de ningún proveedor en este entorno ni
 * una skill que fije uno concreto para embeddings (a diferencia de
 * `claude-api` para texto), este adaptador habla con un endpoint HTTP
 * genérico configurable por entorno (`EMBEDDING_PROVIDER_ENDPOINT` +
 * `EMBEDDING_PROVIDER_API_KEY`) — mismo criterio que `TtsAdapter`/
 * `ImageAdapter` (tarea 4 de la ola 2) para sus proveedores sin credenciales
 * reales: un contrato propio y documentado, pendiente de adaptarse al
 * proveedor que se conecte de verdad.
 *
 * El punto de sustitución para las pruebas es `callProvider`, protegido,
 * igual que `synthesizeFragment` en `TtsAdapter`.
 */
@Injectable()
export class EmbeddingAdapter implements EmbeddingProviderPort {
  constructor(private readonly config: ConfigService) {}

  async embed(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
    const model = this.resolveModel();
    if (texts.length === 0) return { vectors: [], model };

    const credentials = this.requireCredentials();
    const vectors = await this.callProvider(texts, model, credentials);

    for (const vector of vectors) {
      if (vector.length !== MATERIAL_EMBEDDING_DIMENSIONS) {
        throw new EmbeddingDimensionMismatchError(MATERIAL_EMBEDDING_DIMENSIONS, vector.length);
      }
    }
    return { vectors, model };
  }

  private resolveModel(): string {
    return this.config.get<string>("EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL;
  }

  private requireCredentials(): { apiKey: string; endpoint: string } {
    const apiKey = this.config.get<string>("EMBEDDING_PROVIDER_API_KEY");
    const endpoint = this.config.get<string>("EMBEDDING_PROVIDER_ENDPOINT");
    if (!apiKey || !endpoint) throw new MissingEmbeddingProviderCredentialsError();
    return { apiKey, endpoint };
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del proveedor sin tocar la lógica. */
  protected async callProvider(
    texts: string[],
    model: string,
    credentials: { apiKey: string; endpoint: string },
  ): Promise<number[][]> {
    const response = await fetch(credentials.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${credentials.apiKey}` },
      body: JSON.stringify({ input: texts, model }),
    });
    if (!response.ok) {
      throw new Error(`El proveedor de embeddings respondió ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return payload.data.map((d) => d.embedding);
  }
}
