import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * Formato de un material subido por la escuela. Espejo de `material_format`
 * (`packages/db/src/schema/enums.ts`), comprobado en `enums-match-db.spec.ts`.
 */
export const MaterialFormat = {
  Pdf: "pdf",
  Docx: "docx",
  Mp3: "mp3",
  Wav: "wav",
  Mp4: "mp4",
  Jpg: "jpg",
  Png: "png",
} as const;

export type MaterialFormat = (typeof MaterialFormat)[keyof typeof MaterialFormat];

/** Compatibilidad: listas y mensajes de error trabajan contra un array, igual que `EXERCISE_TYPES`. */
export const MATERIAL_FORMATS = Object.values(MaterialFormat) as readonly MaterialFormat[];

/** Tope de 100 MB por fichero: un vídeo de una clase entera va a `classroom`, no aquí. */
export const MAX_MATERIAL_BYTES = 100 * 1024 * 1024;

const MIME_BY_FORMAT: Record<MaterialFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  jpg: "image/jpeg",
  png: "image/png",
};

/** Solo estos dos formatos llevan texto que extraer e indexar con `pgvector`. */
const TEXT_EXTRACTABLE_FORMATS: ReadonlySet<MaterialFormat> = new Set(["pdf", "docx"]);

/**
 * Se rechaza con la lista de los formatos válidos, nunca con un genérico
 * «formato no soportado»: quien sube el fichero necesita saber qué SÍ vale.
 */
export class UnsupportedMaterialFormatError extends DomainError {
  readonly code = "unsupported_material_format";
  readonly kind = "invalid_input" as const;

  constructor(declaredFilename: string) {
    const lista = MATERIAL_FORMATS.map((f) => f.toUpperCase()).join(", ");
    super(
      `«${declaredFilename}» no tiene un formato admitido. Formatos válidos: ${lista}.`,
      // `validFormats` (array) es para el cliente, que puede querer pintar la
      // lista a su manera; `validFormatsLabel` es el escalar que interpola el
      // mensaje traducido — un patrón ICU no sabe unir un array, y la regla de
      // la ola es que los parámetros del texto sean escalares.
      { declaredFilename, validFormats: [...MATERIAL_FORMATS], validFormatsLabel: lista },
    );
  }
}

export class MaterialTooLargeError extends DomainError {
  readonly code = "material_too_large";
  readonly kind = "invalid_input" as const;

  constructor(bytes: number) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
    super(
      `El fichero pesa ${mb(bytes)} MB; el tope es ${mb(MAX_MATERIAL_BYTES)} MB. Un vídeo de una ` +
        "clase entera va a «classroom», no aquí.",
      // Los megabytes van ya formateados como escalar: el patrón traducido no
      // tiene que saber dividir entre 1024 dos veces, y así los cinco idiomas
      // dicen exactamente la misma cifra.
      { bytes, maxBytes: MAX_MATERIAL_BYTES, megabytes: mb(bytes), maxMegabytes: mb(MAX_MATERIAL_BYTES) },
    );
  }
}

/**
 * Detecta el formato real de un fichero por su contenido — los "magic
 * bytes" que un lector de verdad comprobaría — y NUNCA por la extensión del
 * nombre declarado ni por un `Content-Type` que el cliente podría mentir.
 * Un fichero subido es una entrada hostil: el tipo se comprueba de verdad.
 *
 * Devuelve `null` si ninguna firma conocida encaja: quien llama decide qué
 * hacer con eso (aquí, rechazar con la lista de formatos válidos).
 */
function sniffFormat(bytes: Buffer): MaterialFormat | null {
  if (bytes.length < 4) return null;

  // PDF: "%PDF-"
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";

  // PNG: firma fija de 8 bytes.
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";

  // WAV: "RIFF"...."WAVE" (el tamaño del chunk en medio no se comprueba).
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WAVE"
  ) {
    return "wav";
  }

  // MP4/ISO BMFF: la caja "ftyp" empieza en el byte 4 (los 4 primeros son su tamaño).
  if (bytes.length >= 8 && bytes.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";

  // DOCX: es un ZIP (firma local "PK\x03\x04") cuya primera entrada nombra
  // "word/document.xml" en claro dentro de la cabecera — se comprueba ese
  // nombre para no confundirlo con un XLSX, un PPTX o un ZIP cualquiera.
  const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(ZIP_SIGNATURE)) {
    const window = bytes.subarray(0, Math.min(bytes.length, 4096)).toString("latin1");
    if (window.includes("word/document.xml")) return "docx";
    return null;
  }

  // JPG: "FF D8 FF" (se comprueba ANTES que el frame sync de MP3, con el
  // que no puede confundirse: el tercer byte de un JPEG real es siempre
  // 0xFF, y el segundo byte de un frame MP3 nunca lo es).
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";

  // MP3 con etiqueta ID3v2: "ID3".
  if (bytes.subarray(0, 3).toString("latin1") === "ID3") return "mp3";

  // MP3 sin ID3: sincronización de frame MPEG — 11 bits a 1 (0xFF seguido
  // de un byte cuyos 3 bits altos también están a 1).
  const b0 = bytes[0];
  const b1 = bytes[1];
  if (b0 === 0xff && b1 !== undefined && (b1 & 0xe0) === 0xe0) return "mp3";

  return null;
}

/**
 * Material propio subido por la escuela, ya validado.
 *
 * `create()` es la única puerta de entrada: comprueba tamaño y formato antes
 * de que exista ningún objeto, así que un `UploadedMaterial` en memoria
 * SIEMPRE es uno que ya pasó las dos comprobaciones. El almacenamiento real
 * (subir a S3, extraer texto, indexar con `pgvector`) es cosa del caso de
 * uso (`upload-material.handler.ts`), no de este VO — aquí solo se decide si
 * el fichero se acepta o se rechaza.
 */
export class UploadedMaterial {
  private constructor(
    private readonly _format: MaterialFormat,
    private readonly _mimeType: string,
    private readonly _bytesBuffer: Buffer,
    private readonly _declaredFilename: string,
  ) {}

  static create(params: {
    bytes: Buffer;
    declaredFilename: string;
    /** Nunca se usa para decidir el formato: solo queda de metadato informativo. */
    declaredMimeType?: string;
  }): UploadedMaterial {
    if (params.bytes.byteLength > MAX_MATERIAL_BYTES) {
      throw new MaterialTooLargeError(params.bytes.byteLength);
    }

    const format = sniffFormat(params.bytes);
    if (!format) {
      throw new UnsupportedMaterialFormatError(params.declaredFilename);
    }

    return new UploadedMaterial(format, MIME_BY_FORMAT[format], params.bytes, params.declaredFilename);
  }

  get format(): MaterialFormat {
    return this._format;
  }

  /** El tipo MIME real, derivado del formato detectado — nunca el que declaró el cliente. */
  get mimeType(): string {
    return this._mimeType;
  }

  get bytes(): number {
    return this._bytesBuffer.byteLength;
  }

  get buffer(): Buffer {
    return this._bytesBuffer;
  }

  get declaredFilename(): string {
    return this._declaredFilename;
  }

  /** Solo PDF y DOCX llevan texto que extraer e indexar con `pgvector`. */
  get requiresTextExtraction(): boolean {
    return TEXT_EXTRACTABLE_FORMATS.has(this._format);
  }
}
