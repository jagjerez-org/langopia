import type Anthropic from "@anthropic-ai/sdk";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { MissingAnthropicApiKeyError } from "./claude-content-generator.adapter.js";
import { ImageAdapter, ImageGenerationFailedError, MissingImageProviderCredentialsError } from "./image.adapter.js";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";
import type { ObjectStoragePort } from "../../../shared/domain/ports/object-storage.port.js";

function configWith(values: Record<string, string | number | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function fakeObjectStorage(): ObjectStoragePort & { puts: Array<{ key: string; body: Buffer; contentType: string }> } {
  const puts: Array<{ key: string; body: Buffer; contentType: string }> = [];
  return {
    puts,
    put: async (params) => {
      puts.push(params);
    },
    delete: async () => undefined,
  };
}

function fakeResponse<T>(
  parsedOutput: T | null,
  usage: { input_tokens: number; output_tokens: number } = { input_tokens: 100, output_tokens: 50 },
  stopReason: string = "end_turn",
) {
  return { usage, stop_reason: stopReason, parsed_output: parsedOutput };
}

const FULL_CONFIG = {
  IMAGE_PROVIDER_API_KEY: "img-test-key",
  IMAGE_PROVIDER_ENDPOINT: "https://images.example/generate",
  ANTHROPIC_API_KEY: "sk-ant-test",
};

const BASE_PARAMS = {
  schoolKey: "atlantico",
  unitCode: "ES-B1-U07",
  sequence: 2,
  prompt: "Un paciente hablando con un médico en la consulta.",
  sourceLocale: "es-ES",
  targetLocales: ["es-ES", "en-GB", "de-DE"],
};

/** Expone `generateImageBytes` y `createClient` para sustituirlos por dobles en cada prueba. */
class TestableImageAdapter extends ImageAdapter {
  generateImageBytesCalls: string[] = [];
  generateImageBytesImpl: () => Promise<{ bytes: Buffer; mimeType: string; costCents?: number }> = async () => ({
    bytes: Buffer.from("imagen"),
    mimeType: "image/png",
  });
  parseImpl: (params: unknown) => Promise<unknown> = () => {
    throw new Error("no configurado en esta prueba");
  };
  createClientCalls = 0;

  protected override async generateImageBytes(prompt: string): Promise<{ bytes: Buffer; mimeType: string; costCents?: number }> {
    this.generateImageBytesCalls.push(prompt);
    return this.generateImageBytesImpl();
  }

  protected override createClient(): Anthropic {
    this.createClientCalls += 1;
    return { messages: { parse: (params: unknown) => this.parseImpl(params) } } as unknown as Anthropic;
  }
}

describe("ImageAdapter.generateImage", () => {
  it("sin credenciales del proveedor de imagen, rechaza sin llamar a nada", async () => {
    const adapter = new TestableImageAdapter(
      configWith({ ANTHROPIC_API_KEY: "sk-ant-test" }),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );

    await expect(adapter.generateImage(BASE_PARAMS)).rejects.toBeInstanceOf(MissingImageProviderCredentialsError);
    expect(adapter.generateImageBytesCalls).toHaveLength(0);
  });

  it("sin ANTHROPIC_API_KEY, rechaza con MissingAnthropicApiKeyError sin generar la imagen", async () => {
    const adapter = new TestableImageAdapter(
      configWith({ IMAGE_PROVIDER_API_KEY: "img-test-key", IMAGE_PROVIDER_ENDPOINT: "https://images.example/generate" }),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );

    await expect(adapter.generateImage(BASE_PARAMS)).rejects.toBeInstanceOf(MissingAnthropicApiKeyError);
    expect(adapter.generateImageBytesCalls).toHaveLength(0);
  });

  it("genera la imagen, traduce el alt text a todos los idiomas de la escuela y guarda con la clave correcta", async () => {
    const objectStorage = fakeObjectStorage();
    const adapter = new TestableImageAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(objectStorage));
    adapter.parseImpl = async () =>
      fakeResponse({ "en-GB": "A patient talking to a doctor in the consultation room.", "de-DE": "Ein Patient spricht mit einem Arzt." });

    const result = await adapter.generateImage(BASE_PARAMS);

    expect(result.storageKey).toBe("atlantico/units/ES-B1-U07/image-2");
    expect(objectStorage.puts).toHaveLength(1);
    expect(result.altText["es-ES"]).toBe(BASE_PARAMS.prompt); // el idioma de origen no se traduce, es el propio prompt
    expect(result.altText["en-GB"]).toBe("A patient talking to a doctor in the consultation room.");
    expect(result.altText["de-DE"]).toBe("Ein Patient spricht mit einem Arzt.");
    expect(Object.keys(result.altText).sort()).toEqual(["de-DE", "en-GB", "es-ES"]);
    expect(result.cost.unitsProduced).toBe(1);
    expect(result.cost.costCents).toBeGreaterThan(0);
  });

  it("no traduce el idioma de origen: solo pide al modelo los idiomas restantes", async () => {
    const adapter = new TestableImageAdapter(
      configWith(FULL_CONFIG),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );
    let seenPrompt = "";
    adapter.parseImpl = async (params) => {
      seenPrompt = (params as { messages: Array<{ content: string }> }).messages[0]!.content;
      return fakeResponse({ "en-GB": "translated", "de-DE": "translated" });
    };

    await adapter.generateImage(BASE_PARAMS);

    expect(seenPrompt).toContain("en-GB, de-DE");
    expect(seenPrompt).not.toContain("es-ES.");
  });

  it("si faltan idiomas en la primera salida, reintenta con el error como contexto y termina en verde", async () => {
    const adapter = new TestableImageAdapter(
      configWith(FULL_CONFIG),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );
    let calls = 0;
    const seenPrompts: string[] = [];
    adapter.parseImpl = async (params) => {
      calls++;
      seenPrompts.push((params as { messages: Array<{ content: string }> }).messages[0]!.content);
      if (calls === 1) return fakeResponse({ "en-GB": "translated" }); // falta de-DE
      return fakeResponse({ "en-GB": "translated", "de-DE": "translated" });
    };

    const result = await adapter.generateImage(BASE_PARAMS);

    expect(calls).toBe(2);
    expect(seenPrompts[1]).toContain("de-DE");
    expect(result.altText["de-DE"]).toBe("translated");
  });

  it("si dos intentos seguidos fallan, lanza ImageGenerationFailedError con el coste de la imagen más el de los intentos", async () => {
    const adapter = new TestableImageAdapter(
      configWith(FULL_CONFIG),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );
    adapter.generateImageBytesImpl = async () => ({ bytes: Buffer.from("imagen"), mimeType: "image/png", costCents: 10 });
    let calls = 0;
    adapter.parseImpl = async () => {
      calls++;
      return fakeResponse({ "en-GB": "translated" }); // siempre falta de-DE
    };

    const promise = adapter.generateImage(BASE_PARAMS);

    await expect(promise).rejects.toBeInstanceOf(ImageGenerationFailedError);
    expect(calls).toBe(2);
    const error = (await promise.catch((e: unknown) => e)) as ImageGenerationFailedError;
    expect(error.cost.costCents).toBeGreaterThanOrEqual(10); // al menos lo que costó la imagen, que sí se generó
  });

  it("cuando el proveedor de imagen devuelve su propio coste, lo usa en vez del provisional", async () => {
    const adapter = new TestableImageAdapter(
      configWith(FULL_CONFIG),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );
    adapter.generateImageBytesImpl = async () => ({ bytes: Buffer.from("imagen"), mimeType: "image/png", costCents: 250 });
    adapter.parseImpl = async () => fakeResponse({ "en-GB": "t", "de-DE": "t" }, { input_tokens: 0, output_tokens: 0 });

    const result = await adapter.generateImage(BASE_PARAMS);

    expect(result.cost.costCents).toBe(250);
  });
});
