import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { TextExtractionAdapter, UnextractableMaterialFormatError } from "./text-extraction.adapter.js";

/**
 * Construye un PDF de verdad, mínimo pero válido (objetos, tabla `xref` y
 * `trailer`), con `text` como único contenido de su página — nada de mocks
 * de `pdf-parse`: si esto no fuera un PDF real, la biblioteca no lo leería.
 */
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> ` +
      `/MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n`,
  );
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  objects.push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

/** ZIP mínimo sin compresión (`stored`): lo justo para que `mammoth` lea `word/document.xml`. */
function buildZip(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const { name, content } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = zlib.crc32(content) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    const local = Buffer.concat([localHeader, nameBuf, content]);
    localParts.push(local);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([centralHeader, nameBuf]));

    offset += local.length;
  }
  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, end]);
}

function buildMinimalDocx(text: string): Buffer {
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
    `Target="word/document.xml"/></Relationships>`;
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;

  return buildZip([
    { name: "[Content_Types].xml", content: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", content: Buffer.from(rootRels, "utf8") },
    { name: "word/document.xml", content: Buffer.from(documentXml, "utf8") },
  ]);
}

describe("TextExtractionAdapter", () => {
  const adapter = new TextExtractionAdapter();

  it("extrae el texto de un PDF real", async () => {
    const pdf = buildMinimalPdf("Hola desde un PDF de verdad");
    const text = await adapter.extract("pdf", pdf);
    expect(text).toContain("Hola desde un PDF de verdad");
  });

  it("extrae el texto de un DOCX real", async () => {
    const docx = buildMinimalDocx("Hola desde un DOCX de verdad");
    const text = await adapter.extract("docx", docx);
    expect(text).toContain("Hola desde un DOCX de verdad");
  });

  it("rechaza pedir texto de un formato que no lo lleva", async () => {
    await expect(adapter.extract("jpg", Buffer.from([0xff, 0xd8, 0xff]))).rejects.toBeInstanceOf(
      UnextractableMaterialFormatError,
    );
  });
});
