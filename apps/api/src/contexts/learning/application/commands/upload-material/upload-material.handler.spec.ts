import { randomUUID } from "node:crypto";
import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { ObjectStoragePort } from "../../../../shared/domain/ports/object-storage.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { EmbeddingProviderPort } from "../../../domain/ports/embedding-provider.port.js";
import type { MaterialRecord, MaterialRepository } from "../../../domain/ports/material.repository.port.js";
import { MaterialTooLargeError, UnsupportedMaterialFormatError } from "../../../domain/model/uploaded-material.vo.js";
import { TextExtractionAdapter } from "../../../infrastructure/external/text-extraction.adapter.js";
import { UploadMaterialCommand } from "./upload-material.command.js";
import { UploadMaterialHandler, buildMaterialStorageKey } from "./upload-material.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-27T10:00:00Z");
const EMBEDDING_DIMENSIONS = 8; // en las pruebas basta con una dimensión pequeña

/** Un PDF real y mínimo (objetos, `xref`, `trailer`) — no un mock de `pdf-parse`. */
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

const JPG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 0x20)]);

function fakeStorage(): ObjectStoragePort & { puts: Array<{ key: string; contentType: string }> } {
  const puts: Array<{ key: string; contentType: string }> = [];
  return {
    puts,
    put: async ({ key, contentType }) => {
      puts.push({ key, contentType });
    },
    delete: async () => undefined,
  };
}

function fakeEmbeddings(overrides?: Partial<EmbeddingProviderPort>): EmbeddingProviderPort {
  return {
    embed: async (texts) => ({
      vectors: texts.map((_, i) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_v, d) => (d + i) / 10)),
      model: "test-embedding-model",
    }),
    ...overrides,
  };
}

function fakeMaterials(): MaterialRepository & { saved: unknown[]; indexed: unknown[] } {
  const saved: unknown[] = [];
  const indexed: unknown[] = [];
  const repository: MaterialRepository = {
    save: async (params) => void saved.push(params),
    markIndexed: async (params) => void indexed.push(params),
    findById: async () => null as MaterialRecord | null,
    findRelevantChunks: async () => [],
    linkToContentUnit: async () => undefined,
  };
  return { ...repository, saved, indexed };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeTenant(): TenantContext {
  return { schoolId: () => ESCUELA, membershipId: () => ACTOR, roles: () => ["owner"], has: () => true };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeIds(): IdGenerator {
  return { generate: () => randomUUID() };
}
function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function buildHandler(params?: { embeddings?: EmbeddingProviderPort }) {
  const materials = fakeMaterials();
  const storage = fakeStorage();
  const embeddings = params?.embeddings ?? fakeEmbeddings();
  const handler = new UploadMaterialHandler(
    materials,
    storage,
    embeddings,
    new TextExtractionAdapter(),
    fakeUow(),
    fakeTenant(),
    fakeClock(),
    fakeIds(),
    fakeLogger(),
  );
  return { handler, materials, storage };
}

describe("UploadMaterialHandler", () => {
  it("rechaza un formato no admitido antes de tocar almacenamiento o Postgres", async () => {
    const { handler, storage, materials } = buildHandler();
    await expect(
      handler.execute(
        new UploadMaterialCommand({ bytes: Buffer.from("texto suelto, ningún formato"), declaredFilename: "a.exe" }),
      ),
    ).rejects.toBeInstanceOf(UnsupportedMaterialFormatError);
    expect(storage.puts).toHaveLength(0);
    expect(materials.saved).toHaveLength(0);
  });

  it("rechaza un fichero de 150 MB antes de tocar almacenamiento o Postgres", async () => {
    const { handler, storage, materials } = buildHandler();
    const grande = Buffer.concat([JPG_BYTES, Buffer.alloc(150 * 1024 * 1024)]);
    await expect(
      handler.execute(new UploadMaterialCommand({ bytes: grande, declaredFilename: "foto.jpg" })),
    ).rejects.toBeInstanceOf(MaterialTooLargeError);
    expect(storage.puts).toHaveLength(0);
    expect(materials.saved).toHaveLength(0);
  });

  it("sube el original tal cual, sin extracción, para un formato que no lleva texto (jpg)", async () => {
    const { handler, storage, materials } = buildHandler();
    const result = await handler.execute(
      new UploadMaterialCommand({ bytes: JPG_BYTES, declaredFilename: "foto-clase.jpg" }),
    );
    expect(result.format).toBe("jpg");
    expect(result.indexed).toBe(false);
    expect(storage.puts).toHaveLength(1); // solo el original, nunca un "procesado" para jpg
    expect(storage.puts[0]!.contentType).toBe("image/jpeg");
    expect(materials.saved).toHaveLength(1);
    expect(materials.indexed).toHaveLength(0);
  });

  it("extrae texto, trocea, genera embeddings y guarda el material indexado (pdf)", async () => {
    const { handler, storage, materials } = buildHandler();
    const pdf = buildMinimalPdf("Contenido real del material subido por la escuela");
    const result = await handler.execute(
      new UploadMaterialCommand({ bytes: pdf, declaredFilename: "manual.pdf" }),
    );

    expect(result.format).toBe("pdf");
    expect(result.indexed).toBe(true);
    expect(storage.puts).toHaveLength(2); // original + procesado (el texto extraído)
    expect(materials.saved).toHaveLength(1);
    expect(materials.indexed).toHaveLength(1);

    const indexado = materials.indexed[0] as {
      extractedText: string;
      chunks: Array<{ chunkIndex: number; text: string; embedding: number[] }>;
    };
    expect(indexado.extractedText).toContain("Contenido real del material subido por la escuela");
    expect(indexado.chunks.length).toBeGreaterThan(0);
    expect(indexado.chunks[0]!.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("un fallo de indexado (sin proveedor de embeddings) NO deshace la subida ya hecha", async () => {
    const fallando: EmbeddingProviderPort = {
      embed: async () => {
        throw new Error("MissingEmbeddingProviderCredentialsError simulado");
      },
    };
    const { handler, storage, materials } = buildHandler({ embeddings: fallando });
    const pdf = buildMinimalPdf("Contenido que no se llega a indexar en esta prueba");

    const result = await handler.execute(
      new UploadMaterialCommand({ bytes: pdf, declaredFilename: "manual.pdf" }),
    );

    expect(result.indexed).toBe(false);
    expect(storage.puts).toHaveLength(1); // el original SÍ se subió
    expect(materials.saved).toHaveLength(1); // el material SÍ se registró
    expect(materials.indexed).toHaveLength(0); // pero no quedó indexado
  });

  it("determina la clave de almacenamiento a partir de escuela, material y parte", () => {
    const key = buildMaterialStorageKey({
      schoolId: ESCUELA,
      materialId: "33333333-3333-4333-8333-333333333333",
      part: "original",
      extension: "pdf",
    });
    expect(key).toBe(`${ESCUELA}/materials/33333333-3333-4333-8333-333333333333/original.pdf`);
  });
});
