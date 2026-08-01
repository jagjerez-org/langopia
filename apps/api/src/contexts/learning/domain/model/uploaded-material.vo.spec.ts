import { describe, expect, it } from "vitest";
import {
  MATERIAL_FORMATS,
  MAX_MATERIAL_BYTES,
  MaterialTooLargeError,
  UnsupportedMaterialFormatError,
  UploadedMaterial,
} from "./uploaded-material.vo.js";

/**
 * Cada buffer es el arranque REAL de un fichero de ese formato — la firma
 * (los "magic bytes") que un lector de verdad comprobaría, no una extensión
 * ni un `Content-Type` que el cliente podría mentir. El resto del fichero es
 * relleno: el sniffing solo mira la cabecera.
 */
const RELLENO = Buffer.alloc(64, 0x20);

const PDF_HEADER = Buffer.concat([Buffer.from("%PDF-1.7\n"), RELLENO]);
const PNG_HEADER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  RELLENO,
]);
const JPG_HEADER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), RELLENO]);
const WAV_HEADER = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WAVE"),
  RELLENO,
]);
const MP4_HEADER = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypmp42"),
  RELLENO,
]);
const MP3_ID3_HEADER = Buffer.concat([Buffer.from("ID3"), Buffer.from([0x03, 0x00]), RELLENO]);
const MP3_FRAME_HEADER = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), RELLENO]);

/**
 * Un DOCX es un ZIP (firma `PK\x03\x04`) que además guarda, sin comprimir,
 * el nombre del primer fichero de la entrada local — `word/document.xml`—
 * dentro de la cabecera. Comprobar ese nombre en claro es lo que distingue
 * un DOCX de un XLSX o un ZIP cualquiera sin tener que descomprimir nada.
 */
const DOCX_HEADER = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(26, 0x00),
  Buffer.from("word/document.xml"),
  RELLENO,
]);
const GENERIC_ZIP_HEADER = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(26, 0x00),
  Buffer.from("readme.txt"),
  RELLENO,
]);

const TEXTO_PLANO = Buffer.from("esto no es ningún formato admitido, es texto suelto");

describe("UploadedMaterial", () => {
  it.each([
    ["pdf", PDF_HEADER],
    ["docx", DOCX_HEADER],
    ["mp3 (ID3v2)", MP3_ID3_HEADER],
    ["mp3 (frame sync sin ID3)", MP3_FRAME_HEADER],
    ["wav", WAV_HEADER],
    ["mp4", MP4_HEADER],
    ["jpg", JPG_HEADER],
    ["png", PNG_HEADER],
  ] as const)("acepta un %s reconocido por su contenido real", (_etiqueta, bytes) => {
    const material = UploadedMaterial.create({ bytes, declaredFilename: "cualquiera.bin" });
    expect(MATERIAL_FORMATS).toContain(material.format);
  });

  it("determina el formato por el contenido, no por la extensión declarada", () => {
    // Extensión .txt, pero el contenido de verdad es un PDF: manda el contenido.
    const material = UploadedMaterial.create({ bytes: PDF_HEADER, declaredFilename: "informe.txt" });
    expect(material.format).toBe("pdf");
  });

  it("rechaza un formato no admitido con la lista de los válidos, no con «formato no soportado»", () => {
    expect(() => UploadedMaterial.create({ bytes: TEXTO_PLANO, declaredFilename: "notas.exe" })).toThrow(
      UnsupportedMaterialFormatError,
    );
    try {
      UploadedMaterial.create({ bytes: TEXTO_PLANO, declaredFilename: "notas.exe" });
      expect.fail("debía lanzar");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedMaterialFormatError);
      const err = error as UnsupportedMaterialFormatError;
      for (const formato of MATERIAL_FORMATS) {
        expect(err.message.toLowerCase()).toContain(formato);
      }
    }
  });

  it("rechaza un ZIP genérico que no es un DOCX real (mismo PK, sin word/document.xml)", () => {
    expect(() =>
      UploadedMaterial.create({ bytes: GENERIC_ZIP_HEADER, declaredFilename: "paquete.docx" }),
    ).toThrow(UnsupportedMaterialFormatError);
  });

  it("rechaza un fichero de 150 MB aunque el contenido sea válido", () => {
    const grande = Buffer.concat([PDF_HEADER, Buffer.alloc(150 * 1024 * 1024 - PDF_HEADER.byteLength)]);
    expect(() => UploadedMaterial.create({ bytes: grande, declaredFilename: "manual.pdf" })).toThrow(
      MaterialTooLargeError,
    );
  });

  it("acepta justo el tope de 100 MB", () => {
    const limite = Buffer.concat([PDF_HEADER, Buffer.alloc(MAX_MATERIAL_BYTES - PDF_HEADER.byteLength)]);
    const material = UploadedMaterial.create({ bytes: limite, declaredFilename: "manual.pdf" });
    expect(material.bytes).toBe(MAX_MATERIAL_BYTES);
  });

  it("expone el tipo MIME real del formato detectado, no uno declarado por el cliente", () => {
    const material = UploadedMaterial.create({
      bytes: PDF_HEADER,
      declaredFilename: "informe.pdf",
      declaredMimeType: "application/x-totally-fake",
    });
    expect(material.mimeType).toBe("application/pdf");
  });

  it("marca que un pdf/docx necesita extracción de texto, y un jpg/mp3 no", () => {
    const pdf = UploadedMaterial.create({ bytes: PDF_HEADER, declaredFilename: "a.pdf" });
    const docx = UploadedMaterial.create({ bytes: DOCX_HEADER, declaredFilename: "a.docx" });
    const jpg = UploadedMaterial.create({ bytes: JPG_HEADER, declaredFilename: "a.jpg" });
    expect(pdf.requiresTextExtraction).toBe(true);
    expect(docx.requiresTextExtraction).toBe(true);
    expect(jpg.requiresTextExtraction).toBe(false);
  });
});
