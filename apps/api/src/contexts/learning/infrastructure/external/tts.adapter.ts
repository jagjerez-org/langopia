import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AlignedTranscriptSegment,
  AudiobookChapterInput,
  AudiobookFragment,
  AudiobookProgress,
  ChapterMark,
  MediaGenerationCost,
  StoredMediaAsset,
} from "../../domain/ports/media-generator.port.js";
import { ContentAssetStorageAdapter } from "./storage.adapter.js";

const AUDIO_MIME_TYPE = "audio/mpeg";

/**
 * Límite de caracteres por petición de síntesis. Los proveedores de voz
 * imponen un límite de este orden por llamada (varía por proveedor, pero
 * ninguno acepta un capítulo entero de golpe); fragmentar por debajo de él es
 * lo que hace posible sintetizar un audiolibro sin que la primera petición
 * falle por tamaño — ver el brief, «los proveedores de voz tienen límite de
 * caracteres por petición».
 */
export const MAX_TTS_FRAGMENT_CHARACTERS = 4500;

/**
 * Velocidad de habla por nivel MCER, relativa a 1.0 (la de un hablante
 * nativo). «A1 más lento que C1» es la regla del brief; los valores
 * intermedios interpolan de forma monótona para que un B1 quede a mitad de
 * camino entre el principiante y el avanzado.
 */
export const SPEECH_RATE_BY_LEVEL: Record<string, number> = {
  A1: 0.75,
  A2: 0.85,
  B1: 0.95,
  B2: 1.0,
  C1: 1.1,
  C2: 1.15,
};
const DEFAULT_SPEECH_RATE = 1.0;

/**
 * Voz por defecto por idioma. Sin esto, dos llamadas para el mismo idioma sin
 * voz explícita podrían elegir voces distintas; con esto, la primera vez que
 * se sintetiza audio para una unidad se fija una voz determinista que el
 * llamante puede persistir y volver a pasar en la siguiente llamada — así
 * los dos audios de la unidad suenan a la misma persona.
 *
 * Identificadores propios, no de un proveedor concreto: quedan pendientes de
 * cuando se conecte un proveedor de TTS real (ver el informe de la tarea).
 */
export const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  es: "es-voice-1",
  en: "en-voice-1",
  fr: "fr-voice-1",
  de: "de-voice-1",
  it: "it-voice-1",
  pt: "pt-voice-1",
};

const DEFAULT_TTS_MODEL = "tts-default";
/** Tarifa provisional en céntimos por segundo, mientras no hay un proveedor de TTS real conectado. */
const DEFAULT_COST_CENTS_PER_SECOND = 0.35;

export function resolveSpeechRate(level: string): number {
  return SPEECH_RATE_BY_LEVEL[level] ?? DEFAULT_SPEECH_RATE;
}

export function resolveVoiceId(language: string, requested?: string): string {
  if (requested) return requested;
  return DEFAULT_VOICE_BY_LANGUAGE[language] ?? `${language}-voice-default`;
}

/**
 * Fragmenta un texto en trozos de como mucho `maxChars`, cortando en un
 * límite de frase (tras «. », «! » o «? ») cuando lo hay dentro del límite,
 * para no partir una frase a mitad. Si no hay ningún límite de frase dentro
 * de la ventana, corta por la última palabra completa.
 */
export function splitIntoFragments(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const fragments: string[] = [];
  let remaining = trimmed;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const lastSentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    let cutAt: number;
    if (lastSentenceBreak > 0) {
      cutAt = lastSentenceBreak + 2; // conserva el signo y el espacio en el fragmento que se cierra
    } else {
      const lastSpace = window.lastIndexOf(" ");
      cutAt = lastSpace > 0 ? lastSpace + 1 : maxChars;
    }
    fragments.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt);
  }
  if (remaining.trim().length > 0) fragments.push(remaining.trim());
  return fragments;
}

function fragmentKey(chapterIndex: number, fragmentIndex: number): string {
  return `${chapterIndex}.${fragmentIndex}`;
}

/**
 * Sin `TTS_API_KEY` y `TTS_PROVIDER_ENDPOINT` no hay forma de sintetizar
 * audio en este entorno. Falla limpio y pronto, antes de fragmentar el texto
 * o de intentar ninguna llamada.
 */
export class MissingTtsCredentialsError extends Error {
  constructor() {
    super("Faltan TTS_API_KEY o TTS_PROVIDER_ENDPOINT: no se puede sintetizar audio en este entorno.");
    this.name = "MissingTtsCredentialsError";
  }
}

/**
 * Un fallo a mitad de un audiolibro no tira lo ya sintetizado: `progress`
 * lleva la voz en uso y los fragmentos ya completados, para que el siguiente
 * intento los pase de vuelta en `resumeFrom` y reanude justo donde se cortó
 * — «regenerar 40 minutos de audio por un corte de red es tirar dinero»
 * (brief, verbatim). `cost` es SOLO el de los fragmentos sintetizados en
 * ESTE intento: los de un intento anterior ya se registraron entonces, y
 * sumarlos otra vez duplicaría el gasto real.
 */
export class AudiobookSynthesisFailedError extends Error {
  constructor(
    message: string,
    readonly cost: MediaGenerationCost,
    readonly progress: AudiobookProgress,
  ) {
    super(message);
    this.name = "AudiobookSynthesisFailedError";
  }
}

type SpeechResult = StoredMediaAsset & { durationMs: number; voiceId: string; cost: MediaGenerationCost };
type AudiobookResult = StoredMediaAsset & {
  durationMs: number;
  voiceId: string;
  chapterMarks: ChapterMark[];
  transcript: AlignedTranscriptSegment[];
  cost: MediaGenerationCost;
};

/**
 * Adaptador de TTS: implementa la parte de audio de `MediaGeneratorPort`
 * (`synthesizeSpeech` para la pista corta de un ejercicio, `synthesizeAudiobook`
 * para el audiolibro con capítulos). `ImageAdapter`, en el fichero hermano,
 * implementa la otra parte (`generateImage`); ver el informe de la tarea
 * para por qué son dos clases y no una sola implementando el puerto entero.
 *
 * El proveedor de voz concreto es un HTTP genérico configurado por entorno
 * (`TTS_PROVIDER_ENDPOINT`, `TTS_API_KEY`): sin credenciales reales de
 * ningún proveedor en este entorno, el contrato de la petición es propio,
 * pendiente de adaptarse al proveedor que se conecte de verdad (ver el
 * informe). El punto de sustitución para las pruebas es
 * `synthesizeFragment`, protegido, igual que `createClient` en
 * `ClaudeContentGeneratorAdapter`.
 */
@Injectable()
export class TtsAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: ContentAssetStorageAdapter,
  ) {}

  async synthesizeSpeech(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    text: string;
    language: string;
    level: string;
    voiceId?: string;
  }): Promise<SpeechResult> {
    const credentials = this.requireCredentials();
    const voiceId = resolveVoiceId(params.language, params.voiceId);
    const speechRate = resolveSpeechRate(params.level);
    const fragments = splitIntoFragments(params.text, MAX_TTS_FRAGMENT_CHARACTERS);

    const buffers: Buffer[] = [];
    let durationMs = 0;
    let costCentsExact = 0;
    for (const text of fragments) {
      const fragment = await this.synthesizeFragment({ text, voiceId, speechRate, language: params.language }, credentials);
      buffers.push(fragment.audio);
      durationMs += fragment.durationMs;
      costCentsExact += this.costCentsFor(fragment.durationMs);
    }

    const stored = await this.storage.store({
      schoolKey: params.schoolKey,
      unitCode: params.unitCode,
      kind: "audio",
      sequence: params.sequence,
      body: Buffer.concat(buffers),
      contentType: AUDIO_MIME_TYPE,
    });

    return { ...stored, durationMs, voiceId, cost: this.finalizeCost(costCentsExact, durationMs) };
  }

  async synthesizeAudiobook(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    chapters: AudiobookChapterInput[];
    language: string;
    level: string;
    voiceId?: string;
    resumeFrom?: AudiobookProgress;
  }): Promise<AudiobookResult> {
    const credentials = this.requireCredentials();
    // La voz de un reintento es la que ya se venía usando: cambiarla a mitad
    // de un audiolibro es exactamente lo que la regla «misma voz para toda
    // la unidad» prohíbe.
    const voiceId = params.resumeFrom?.voiceId ?? resolveVoiceId(params.language, params.voiceId);
    const speechRate = resolveSpeechRate(params.level);

    // El plan completo de fragmentos se calcula ANTES de sintetizar nada:
    // es lo que permite saber, al reanudar, exactamente cuáles ya están
    // hechos y cuáles faltan, sin volver a fragmentar por sorpresa distinto.
    const plan: Array<{ chapterIndex: number; fragmentIndex: number; text: string }> = [];
    params.chapters.forEach((chapter, chapterIndex) => {
      splitIntoFragments(chapter.text, MAX_TTS_FRAGMENT_CHARACTERS).forEach((text, fragmentIndex) => {
        plan.push({ chapterIndex, fragmentIndex, text });
      });
    });

    const completed = new Map<string, AudiobookFragment>();
    for (const fragment of params.resumeFrom?.completedFragments ?? []) {
      completed.set(fragmentKey(fragment.chapterIndex, fragment.fragmentIndex), fragment);
    }

    let costCentsExactThisAttempt = 0;
    let durationMsThisAttempt = 0;

    for (const step of plan) {
      const key = fragmentKey(step.chapterIndex, step.fragmentIndex);
      if (completed.has(key)) continue; // ya sintetizado en un intento anterior: no se vuelve a pagar

      try {
        const fragment = await this.synthesizeFragment(
          { text: step.text, voiceId, speechRate, language: params.language },
          credentials,
        );
        completed.set(key, { ...step, audio: fragment.audio, durationMs: fragment.durationMs });
        costCentsExactThisAttempt += this.costCentsFor(fragment.durationMs);
        durationMsThisAttempt += fragment.durationMs;
      } catch (error) {
        throw new AudiobookSynthesisFailedError(
          `La síntesis del audiolibro falló en el fragmento ${key} (capítulo «${params.chapters[step.chapterIndex]!.title}»): ` +
            (error instanceof Error ? error.message : String(error)),
          this.finalizeCost(costCentsExactThisAttempt, durationMsThisAttempt),
          { voiceId, completedFragments: [...completed.values()] },
        );
      }
    }

    // Concatenación en orden de plan (capítulo, fragmento), con marcas de
    // capítulo en el desplazamiento acumulado y transcripción alineada
    // fragmento a fragmento.
    const buffers: Buffer[] = [];
    const chapterMarks: ChapterMark[] = [];
    const transcript: AlignedTranscriptSegment[] = [];
    let cursorMs = 0;
    let lastChapterIndex = -1;
    for (const step of plan) {
      const fragment = completed.get(fragmentKey(step.chapterIndex, step.fragmentIndex))!;
      if (fragment.chapterIndex !== lastChapterIndex) {
        lastChapterIndex = fragment.chapterIndex;
        chapterMarks.push({ title: params.chapters[fragment.chapterIndex]!.title, offsetMs: cursorMs });
      }
      buffers.push(fragment.audio);
      const startMs = cursorMs;
      cursorMs += fragment.durationMs;
      transcript.push({ text: fragment.text, startMs, endMs: cursorMs });
    }

    const stored = await this.storage.store({
      schoolKey: params.schoolKey,
      unitCode: params.unitCode,
      kind: "audio",
      sequence: params.sequence,
      body: Buffer.concat(buffers),
      contentType: AUDIO_MIME_TYPE,
    });

    return {
      ...stored,
      durationMs: cursorMs,
      voiceId,
      chapterMarks,
      transcript,
      cost: this.finalizeCost(costCentsExactThisAttempt, durationMsThisAttempt),
    };
  }

  private costCentsFor(durationMs: number): number {
    const centsPerSecond = this.config.get<number>("TTS_COST_CENTS_PER_SECOND") ?? DEFAULT_COST_CENTS_PER_SECOND;
    return (durationMs / 1000) * centsPerSecond;
  }

  private finalizeCost(costCentsExact: number, durationMs: number): MediaGenerationCost {
    return {
      unitsProduced: Math.round(durationMs / 1000),
      costCents: Math.round(costCentsExact),
      model: this.resolveModel(),
    };
  }

  private resolveModel(): string {
    return this.config.get<string>("TTS_MODEL") ?? DEFAULT_TTS_MODEL;
  }

  private requireCredentials(): { apiKey: string; endpoint: string } {
    const apiKey = this.config.get<string>("TTS_API_KEY");
    const endpoint = this.config.get<string>("TTS_PROVIDER_ENDPOINT");
    if (!apiKey || !endpoint) throw new MissingTtsCredentialsError();
    return { apiKey, endpoint };
  }

  /** Punto de extensión para las pruebas: sustituir por un doble del proveedor sin tocar la lógica. */
  protected async synthesizeFragment(
    params: { text: string; voiceId: string; speechRate: number; language: string },
    credentials: { apiKey: string; endpoint: string },
  ): Promise<{ audio: Buffer; durationMs: number }> {
    const response = await fetch(credentials.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${credentials.apiKey}` },
      body: JSON.stringify({
        text: params.text,
        voice_id: params.voiceId,
        speed: params.speechRate,
        language: params.language,
      }),
    });
    if (!response.ok) {
      throw new Error(`El proveedor de TTS respondió ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as { audio_base64: string; duration_ms: number };
    return { audio: Buffer.from(payload.audio_base64, "base64"), durationMs: payload.duration_ms };
  }
}
