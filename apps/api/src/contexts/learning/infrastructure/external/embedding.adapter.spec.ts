import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import {
  EmbeddingAdapter,
  EmbeddingDimensionMismatchError,
  MATERIAL_EMBEDDING_DIMENSIONS,
  MissingEmbeddingProviderCredentialsError,
} from "./embedding.adapter.js";

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const FULL_CONFIG = {
  EMBEDDING_PROVIDER_API_KEY: "embed-test-key",
  EMBEDDING_PROVIDER_ENDPOINT: "https://embeddings.example/v1/embed",
};

function vectorOf(dimensions: number, seed: number): number[] {
  return Array.from({ length: dimensions }, (_, i) => (i + seed) / 1000);
}

/** Expone `callProvider` para sustituirlo por un doble del proveedor en cada prueba. */
class TestableEmbeddingAdapter extends EmbeddingAdapter {
  calls: Array<{ texts: string[]; model: string }> = [];
  /** Vectores a devolver, uno por texto de la primera llamada; por defecto la dimensión correcta. */
  vectorsToReturn: number[][] | undefined;

  protected override async callProvider(texts: string[], model: string): Promise<number[][]> {
    this.calls.push({ texts, model });
    return this.vectorsToReturn ?? texts.map((_, i) => vectorOf(MATERIAL_EMBEDDING_DIMENSIONS, i));
  }
}

describe("EmbeddingAdapter", () => {
  it("sin EMBEDDING_PROVIDER_API_KEY o EMBEDDING_PROVIDER_ENDPOINT falla limpio", async () => {
    const adapter = new TestableEmbeddingAdapter(configWith({}));
    await expect(adapter.embed(["un párrafo cualquiera"])).rejects.toBeInstanceOf(
      MissingEmbeddingProviderCredentialsError,
    );
  });

  it("con texts vacío no llama al proveedor", async () => {
    const adapter = new TestableEmbeddingAdapter(configWith({}));
    const result = await adapter.embed([]);
    expect(result.vectors).toEqual([]);
    expect(adapter.calls).toHaveLength(0);
  });

  it("devuelve un vector por texto, en el mismo orden, con credenciales", async () => {
    const adapter = new TestableEmbeddingAdapter(configWith(FULL_CONFIG));
    const result = await adapter.embed(["primero", "segundo", "tercero"]);
    expect(result.vectors).toHaveLength(3);
    expect(adapter.calls[0]!.texts).toEqual(["primero", "segundo", "tercero"]);
  });

  it("usa el modelo por defecto, o el de EMBEDDING_MODEL si se configura", async () => {
    const porDefecto = new TestableEmbeddingAdapter(configWith(FULL_CONFIG));
    await porDefecto.embed(["texto"]);
    expect(porDefecto.calls[0]!.model).toBe("voyage-3");

    const conModeloPropio = new TestableEmbeddingAdapter(
      configWith({ ...FULL_CONFIG, EMBEDDING_MODEL: "otro-modelo" }),
    );
    await conModeloPropio.embed(["texto"]);
    expect(conModeloPropio.calls[0]!.model).toBe("otro-modelo");
  });

  it("rechaza un vector que no trae la dimensión esperada, en vez de dejarlo llegar a Postgres", async () => {
    const adapter = new TestableEmbeddingAdapter(configWith(FULL_CONFIG));
    adapter.vectorsToReturn = [vectorOf(8, 0)]; // dimensión equivocada a propósito
    await expect(adapter.embed(["texto"])).rejects.toBeInstanceOf(EmbeddingDimensionMismatchError);
  });

  it("llama de verdad al proveedor por HTTP cuando no se sustituye callProvider", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        json: async () => ({ data: [{ embedding: vectorOf(MATERIAL_EMBEDDING_DIMENSIONS, 1) }] }),
      } as Response;
    }) as typeof fetch;

    try {
      const adapter = new EmbeddingAdapter(configWith(FULL_CONFIG));
      const result = await adapter.embed(["hola"]);
      expect(result.vectors).toHaveLength(1);
      expect(calls[0]!.url).toBe(FULL_CONFIG.EMBEDDING_PROVIDER_ENDPOINT);
      const body = JSON.parse(String(calls[0]!.init.body)) as { input: string[]; model: string };
      expect(body.input).toEqual(["hola"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
