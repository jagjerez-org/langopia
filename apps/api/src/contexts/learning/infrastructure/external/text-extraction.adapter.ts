import { Injectable } from "@nestjs/common";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { MaterialFormat } from "../../domain/model/uploaded-material.vo.js";

/**
 * Un formato sin texto que extraer (audio, imagen, vídeo) no llega aquí:
 * `UploadedMaterial.requiresTextExtraction` ya lo filtra antes. Si llegara,
 * es un error de quien llama, no un caso silencioso.
 */
export class UnextractableMaterialFormatError extends Error {
  constructor(format: MaterialFormat) {
    super(`«${format}» no lleva texto que extraer.`);
    this.name = "UnextractableMaterialFormatError";
  }
}

/**
 * Extrae el texto de un PDF o DOCX ya subido.
 *
 * Sin llamada a ningún modelo: es un proceso mecánico y determinista sobre
 * el propio fichero (a diferencia de `EmbeddingAdapter`, que sí habla con un
 * proveedor externo para convertir ese texto en un vector). Dos bibliotecas
 * puras de Node, sin dependencias nativas: `pdf-parse` (basada en
 * `pdfjs-dist`) y `mammoth` (lee el XML de un DOCX directamente).
 */
@Injectable()
export class TextExtractionAdapter {
  async extract(format: MaterialFormat, buffer: Buffer): Promise<string> {
    if (format === "pdf") return this.extractFromPdf(buffer);
    if (format === "docx") return this.extractFromDocx(buffer);
    throw new UnextractableMaterialFormatError(format);
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
}
