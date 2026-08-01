import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { ObjectStoragePort } from "../../../shared/domain/ports/object-storage.port.js";
import {
  AudiobookSynthesisFailedError,
  MAX_TTS_FRAGMENT_CHARACTERS,
  MissingTtsCredentialsError,
  resolveSpeechRate,
  resolveVoiceId,
  splitIntoFragments,
  TtsAdapter,
} from "./tts.adapter.js";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";

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

const FULL_CONFIG = { TTS_API_KEY: "tts-test-key", TTS_PROVIDER_ENDPOINT: "https://tts.example/synthesize" };

/** Expone `synthesizeFragment` para sustituirlo por un doble del proveedor en cada prueba. */
class TestableTtsAdapter extends TtsAdapter {
  calls: Array<{ text: string; voiceId: string; speechRate: number; language: string }> = [];
  /** Duraciones (ms) que devuelve cada llamada sucesiva; por defecto 60_000 (1 minuto). */
  fragmentDurationsMs: number[] = [];
  /** Índice (0-based) de llamada en el que lanzar, o `undefined` para no fallar nunca. */
  failOnCallIndex: number | undefined;

  protected override async synthesizeFragment(
    params: { text: string; voiceId: string; speechRate: number; language: string },
  ): Promise<{ audio: Buffer; durationMs: number }> {
    const index = this.calls.length;
    this.calls.push(params);
    if (this.failOnCallIndex === index) {
      throw new Error("corte de red simulado");
    }
    const durationMs = this.fragmentDurationsMs[index] ?? 60_000;
    return { audio: Buffer.from(`audio:${params.text}`), durationMs };
  }
}

const BASE_PARAMS = { schoolKey: "atlantico", unitCode: "ES-B1-U07", sequence: 1 };

describe("resolveSpeechRate", () => {
  it("A1 es más lento que C1, con B2 en la velocidad normal (1.0)", () => {
    expect(resolveSpeechRate("A1")).toBeLessThan(resolveSpeechRate("C1"));
    expect(resolveSpeechRate("B2")).toBe(1.0);
    expect(resolveSpeechRate("A1")).toBeLessThan(resolveSpeechRate("A2"));
    expect(resolveSpeechRate("A2")).toBeLessThan(resolveSpeechRate("B1"));
    expect(resolveSpeechRate("C1")).toBeLessThan(resolveSpeechRate("C2"));
  });

  it("un nivel desconocido usa la velocidad normal", () => {
    expect(resolveSpeechRate("desconocido")).toBe(1.0);
  });
});

describe("resolveVoiceId", () => {
  it("reutiliza la voz pasada explícitamente", () => {
    expect(resolveVoiceId("es", "voz-ya-elegida")).toBe("voz-ya-elegida");
  });

  it("sin voz explícita, el mismo idioma siempre elige la misma voz por defecto", () => {
    expect(resolveVoiceId("es")).toBe(resolveVoiceId("es"));
  });
});

describe("splitIntoFragments", () => {
  it("un texto corto no se fragmenta", () => {
    expect(splitIntoFragments("Hola, ¿cómo estás?", MAX_TTS_FRAGMENT_CHARACTERS)).toEqual(["Hola, ¿cómo estás?"]);
  });

  it("un texto vacío no produce fragmentos", () => {
    expect(splitIntoFragments("   ", 100)).toEqual([]);
  });

  it("corta en el límite de frase, no a mitad de palabra", () => {
    const text = "Primera frase completa. Segunda frase completa. Tercera frase completa.";
    const fragments = splitIntoFragments(text, 30);
    expect(fragments.join(" ")).toBe(text);
    for (const fragment of fragments) {
      expect(fragment.length).toBeLessThanOrEqual(30 + 1); // tolerancia mínima del cierre de frase
    }
  });

  it("ningún fragmento supera el límite pedido, incluso sin puntuación", () => {
    const text = "palabra ".repeat(50).trim();
    const fragments = splitIntoFragments(text, 20);
    for (const fragment of fragments) {
      expect(fragment.length).toBeLessThanOrEqual(20);
    }
    expect(fragments.join(" ")).toBe(text);
  });
});

describe("TtsAdapter.synthesizeSpeech", () => {
  it("sin TTS_API_KEY ni TTS_PROVIDER_ENDPOINT, rechaza con MissingTtsCredentialsError sin llamar al proveedor", async () => {
    const adapter = new TestableTtsAdapter(configWith({}), new ContentAssetStorageAdapter(fakeObjectStorage()));

    await expect(
      adapter.synthesizeSpeech({ ...BASE_PARAMS, text: "hola", language: "es", level: "B1" }),
    ).rejects.toBeInstanceOf(MissingTtsCredentialsError);
    expect(adapter.calls).toHaveLength(0);
  });

  it("sintetiza una pista de 4 minutos, guarda el audio con la clave correcta y devuelve la voz usada", async () => {
    const objectStorage = fakeObjectStorage();
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(objectStorage));
    adapter.fragmentDurationsMs = [4 * 60_000];

    const result = await adapter.synthesizeSpeech({
      ...BASE_PARAMS,
      text: "Un diálogo corto para comprensión oral.",
      language: "es",
      level: "B1",
    });

    expect(result.durationMs).toBe(4 * 60_000);
    expect(result.voiceId).toBe("es-voice-1");
    expect(result.storageKey).toBe("atlantico/units/ES-B1-U07/audio-1");
    expect(objectStorage.puts).toHaveLength(1);
    expect(result.cost.unitsProduced).toBe(240); // 4 minutos = 240 segundos
    expect(result.cost.costCents).toBeGreaterThan(0);
  });

  it("aplica la velocidad de habla del nivel a cada fragmento sintetizado", async () => {
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(fakeObjectStorage()));

    await adapter.synthesizeSpeech({ ...BASE_PARAMS, text: "hola", language: "es", level: "A1" });

    expect(adapter.calls[0]!.speechRate).toBe(resolveSpeechRate("A1"));
  });

  it("reutiliza la voz pasada (dos audios de la misma unidad suenan a la misma persona)", async () => {
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(fakeObjectStorage()));

    const result = await adapter.synthesizeSpeech({
      ...BASE_PARAMS,
      text: "hola",
      language: "es",
      level: "B1",
      voiceId: "voz-ya-fijada-en-la-unidad",
    });

    expect(result.voiceId).toBe("voz-ya-fijada-en-la-unidad");
    expect(adapter.calls[0]!.voiceId).toBe("voz-ya-fijada-en-la-unidad");
  });

  it("un texto por encima del límite de caracteres se fragmenta en varias llamadas, todas con la misma voz", async () => {
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(fakeObjectStorage()));
    const longText = "Frase de relleno para el diálogo. ".repeat(400); // muy por encima del límite

    await adapter.synthesizeSpeech({ ...BASE_PARAMS, text: longText, language: "es", level: "B1" });

    expect(adapter.calls.length).toBeGreaterThan(1);
    const voices = new Set(adapter.calls.map((c) => c.voiceId));
    expect(voices.size).toBe(1);
  });
});

describe("TtsAdapter.synthesizeAudiobook", () => {
  const CHAPTERS = [
    { title: "Capítulo 1", text: "Texto del primer capítulo." },
    { title: "Capítulo 2", text: "Texto del segundo capítulo." },
    { title: "Capítulo 3", text: "Texto del tercer capítulo." },
  ];

  it("sintetiza un audiolibro de 20 minutos con tres capítulos: duración, marcas y alineación correctas", async () => {
    const objectStorage = fakeObjectStorage();
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(objectStorage));
    // Un fragmento por capítulo (los textos de prueba caben en uno): 7 + 7 + 6 = 20 minutos.
    adapter.fragmentDurationsMs = [7 * 60_000, 7 * 60_000, 6 * 60_000];

    const result = await adapter.synthesizeAudiobook({
      ...BASE_PARAMS,
      chapters: CHAPTERS,
      language: "es",
      level: "B1",
    });

    expect(result.durationMs).toBe(20 * 60_000);
    expect(result.chapterMarks).toEqual([
      { title: "Capítulo 1", offsetMs: 0 },
      { title: "Capítulo 2", offsetMs: 7 * 60_000 },
      { title: "Capítulo 3", offsetMs: 14 * 60_000 },
    ]);
    // La transcripción alineada cubre el audio completo sin huecos ni solapes.
    expect(result.transcript).toEqual([
      { text: CHAPTERS[0]!.text, startMs: 0, endMs: 7 * 60_000 },
      { text: CHAPTERS[1]!.text, startMs: 7 * 60_000, endMs: 14 * 60_000 },
      { text: CHAPTERS[2]!.text, startMs: 14 * 60_000, endMs: 20 * 60_000 },
    ]);
    expect(objectStorage.puts).toHaveLength(1);
    expect(result.cost.unitsProduced).toBe(20 * 60);
  });

  it("usa la misma voz en todos los capítulos", async () => {
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(fakeObjectStorage()));

    await adapter.synthesizeAudiobook({ ...BASE_PARAMS, chapters: CHAPTERS, language: "es", level: "B1" });

    const voices = new Set(adapter.calls.map((c) => c.voiceId));
    expect(voices.size).toBe(1);
  });

  it("un fallo a mitad lanza AudiobookSynthesisFailedError con el progreso hasta ese punto, y no reintenta un tercer capítulo", async () => {
    const adapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(fakeObjectStorage()));
    adapter.fragmentDurationsMs = [7 * 60_000];
    adapter.failOnCallIndex = 1; // falla en el segundo capítulo

    const promise = adapter.synthesizeAudiobook({ ...BASE_PARAMS, chapters: CHAPTERS, language: "es", level: "B1" });

    await expect(promise).rejects.toBeInstanceOf(AudiobookSynthesisFailedError);
    const error = (await promise.catch((e: unknown) => e)) as AudiobookSynthesisFailedError;
    expect(error.progress.completedFragments).toHaveLength(1);
    expect(error.progress.completedFragments[0]!.chapterIndex).toBe(0);
    expect(error.progress.voiceId).toBe(adapter.calls[0]!.voiceId);
    // El coste del fallo es solo el del capítulo que sí se sintetizó.
    expect(error.cost.unitsProduced).toBe(7 * 60);
    expect(adapter.calls).toHaveLength(2); // no llegó a intentar el tercer capítulo
  });

  it("reanuda desde el último fragmento tras un fallo: no vuelve a sintetizar lo ya hecho", async () => {
    const failingAdapter = new TestableTtsAdapter(
      configWith(FULL_CONFIG),
      new ContentAssetStorageAdapter(fakeObjectStorage()),
    );
    failingAdapter.fragmentDurationsMs = [7 * 60_000];
    failingAdapter.failOnCallIndex = 1;
    const firstAttempt = failingAdapter.synthesizeAudiobook({
      ...BASE_PARAMS,
      chapters: CHAPTERS,
      language: "es",
      level: "B1",
    });
    const failure = (await firstAttempt.catch((e: unknown) => e)) as AudiobookSynthesisFailedError;

    const objectStorage = fakeObjectStorage();
    const retryAdapter = new TestableTtsAdapter(configWith(FULL_CONFIG), new ContentAssetStorageAdapter(objectStorage));
    retryAdapter.fragmentDurationsMs = [7 * 60_000, 6 * 60_000];

    const result = await retryAdapter.synthesizeAudiobook({
      ...BASE_PARAMS,
      chapters: CHAPTERS,
      language: "es",
      level: "B1",
      resumeFrom: failure.progress,
    });

    // Solo se llamó al proveedor por los DOS capítulos que faltaban, no por los tres.
    expect(retryAdapter.calls).toHaveLength(2);
    expect(result.durationMs).toBe(20 * 60_000);
    expect(result.chapterMarks).toEqual([
      { title: "Capítulo 1", offsetMs: 0 },
      { title: "Capítulo 2", offsetMs: 7 * 60_000 },
      { title: "Capítulo 3", offsetMs: 14 * 60_000 },
    ]);
    // El coste de este intento es solo el de los dos capítulos que sí se pagaron ahora.
    expect(result.cost.unitsProduced).toBe(13 * 60);
  });
});
