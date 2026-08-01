/**
 * Coste real de producir audio o imagen. A diferencia de `GenerationCost`
 * (`content-generator.port.ts`), que factura por tokens, un proveedor de voz
 * o de imagen cobra por lo que produce: segundos de audio, o el número de
 * imágenes. `unitsProduced` es justo lo que espera `ai_generations.units_produced`
 * (`packages/db/src/schema/platform.ts`) — «segundos de audio o número de
 * imágenes, según el tipo»—, y se devuelve SIEMPRE junto al resultado, nunca
 * por separado: la regla de la ola («el coste se registra antes de descontar
 * créditos») exige que quien reciba el contenido tenga el coste a mano.
 */
export type MediaGenerationCost = {
  unitsProduced: number;
  costCents: number;
  model: string;
};

/** Fichero ya subido al almacén de objetos, con la clave `{escuela}/units/{código}/{tipo}-{n}`. */
export type StoredMediaAsset = {
  storageKey: string;
  mimeType: string;
  bytes: number;
};

/** Un capítulo de audiolibro, antes de sintetizar. */
export type AudiobookChapterInput = {
  title: string;
  text: string;
};

/** Marca de capítulo: desde qué milisegundo del audio completo empieza. */
export type ChapterMark = {
  title: string;
  offsetMs: number;
};

/** Transcripción alineada: un segmento de texto con su intervalo en el audio. */
export type AlignedTranscriptSegment = {
  text: string;
  startMs: number;
  endMs: number;
};

/**
 * Un fragmento de audiolibro ya sintetizado. Es la unidad de reanudación:
 * `synthesizeAudiobook` la usa tanto para reportar hasta dónde llegó (cuando
 * falla a mitad) como para recibir de vuelta lo que ya no hay que volver a
 * pagar (cuando se reintenta).
 */
export type AudiobookFragment = {
  chapterIndex: number;
  fragmentIndex: number;
  text: string;
  audio: Buffer;
  durationMs: number;
};

/**
 * Punto desde el que reanudar un audiolibro tras un fallo a mitad: la voz que
 * se venía usando (tiene que seguir siendo la misma) y los fragmentos que ya
 * se sintetizaron y no hay que volver a comprar.
 */
export type AudiobookProgress = {
  voiceId: string;
  completedFragments: AudiobookFragment[];
};

/**
 * Puerto de generación de audio e imagen para `learning`.
 *
 * El dominio no sabe qué proveedor de voz o de imagen hay detrás, ni cómo se
 * fragmenta un texto largo, ni cómo se calcula el coste: solo pide el medio y
 * recibe, junto a él, dónde quedó guardado y qué costó producirlo — igual que
 * `ContentGeneratorPort` con el texto. `schoolKey`, `unitCode`, `kind` y
 * `sequence` son exactamente los cuatro componentes de la clave de
 * almacenamiento (`{escuela}/units/{código}/{tipo}-{n}`); el adaptador nunca
 * inventa una clave por su cuenta, y quien llama nunca necesita saber cuál es
 * el formato exacto para poder llamar.
 *
 * Dos formatos, con reglas distintas (ver el brief de la tarea 4):
 * - `synthesizeSpeech`: la pista corta de un ejercicio (diálogo o texto,
 *   1–5 min). Un único fichero, sin capítulos.
 * - `synthesizeAudiobook`: el audiolibro (10–60 min, con capítulos). Se
 *   sintetiza por fragmentos y se concatena, lleva marcas de capítulo y
 *   transcripción alineada, y un fallo a mitad se reanuda desde el último
 *   fragmento (`resumeFrom`) en vez de desde el principio.
 *
 * Las dos exigen la MISMA voz para toda la unidad (`voiceId`): si no se pasa
 * una ya elegida, el adaptador elige una por idioma y la devuelve, para que
 * quien la reciba la persista y la reutilice en el siguiente audio de la
 * misma unidad — es lo que hace que dos audios de una unidad suenen a la
 * misma persona. La velocidad de habla no se pasa: se decide del `level`
 * (MCER), igual que el resto de la ola.
 */
export interface MediaGeneratorPort {
  synthesizeSpeech(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    text: string;
    language: string;
    level: string;
    /** Si la unidad ya tiene voz asignada, se reutiliza; si no, el adaptador elige una y la devuelve. */
    voiceId?: string;
  }): Promise<
    StoredMediaAsset & {
      durationMs: number;
      voiceId: string;
      cost: MediaGenerationCost;
    }
  >;

  synthesizeAudiobook(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    chapters: AudiobookChapterInput[];
    language: string;
    level: string;
    voiceId?: string;
    /** Presente solo al reintentar tras un fallo a mitad: ver `AudiobookSynthesisFailedError`. */
    resumeFrom?: AudiobookProgress;
  }): Promise<
    StoredMediaAsset & {
      durationMs: number;
      voiceId: string;
      chapterMarks: ChapterMark[];
      transcript: AlignedTranscriptSegment[];
      cost: MediaGenerationCost;
    }
  >;

  generateImage(params: {
    schoolKey: string;
    unitCode: string;
    sequence: number;
    /** Descripción de la imagen a generar, en `sourceLocale`. También es la base del texto alternativo. */
    prompt: string;
    sourceLocale: string;
    /** Idiomas de la escuela (`schools.supported_locales`): el alt text se genera en todos ellos. */
    targetLocales: string[];
  }): Promise<
    StoredMediaAsset & {
      /** Una entrada por cada locale de `targetLocales`, nunca menos. */
      altText: Record<string, string>;
      cost: MediaGenerationCost;
    }
  >;
}

export const MEDIA_GENERATOR_PORT = Symbol("MediaGeneratorPort");
