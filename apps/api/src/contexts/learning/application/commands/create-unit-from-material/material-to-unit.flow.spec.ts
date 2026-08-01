import { randomUUID } from "node:crypto";
import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { ObjectStoragePort } from "../../../../shared/domain/ports/object-storage.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import type { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import { ContentUnitId, MaterialId } from "../../../domain/model/identifiers.js";
import type { AiGenerationRepository } from "../../../domain/ports/ai-generation.repository.port.js";
import type { ContentGeneratorPort, GenerationCost } from "../../../domain/ports/content-generator.port.js";
import type {
  ContentUnitRepository,
  ContentUnitTranslation,
} from "../../../domain/ports/content-unit.repository.port.js";
import type { CreditLedgerPort } from "../../../domain/ports/credit-ledger.port.js";
import type { EmbeddingProviderPort } from "../../../domain/ports/embedding-provider.port.js";
import type {
  MaterialRecord,
  MaterialRepository,
  RelevantChunk,
} from "../../../domain/ports/material.repository.port.js";
import { TextExtractionAdapter } from "../../../infrastructure/external/text-extraction.adapter.js";
import { GenerateUnitCommand } from "../generate-unit/generate-unit.command.js";
import { GenerateUnitHandler } from "../generate-unit/generate-unit.handler.js";
import { UploadMaterialCommand } from "../upload-material/upload-material.command.js";
import { UploadMaterialHandler } from "../upload-material/upload-material.handler.js";
import { CreateUnitFromMaterialCommand } from "./create-unit-from-material.command.js";
import { CreateUnitFromMaterialHandler } from "./create-unit-from-material.handler.js";

/**
 * Paso 8 del brief de la tarea 14, con dobles: «subir un PDF, generar
 * ejercicios de su contenido y comprobar que citan el material, no algo
 * inventado».
 *
 * No hay clave de ningún modelo ni credenciales de almacenamiento en este
 * entorno, así que el proveedor de texto, el de embeddings y el almacén son
 * dobles — pero TODO lo demás es el código real: el PDF es un PDF de verdad
 * que `TextExtractionAdapter` (pdf-parse) lee, el troceo es el real, el
 * encadenado de los tres manejadores es el real, y el doble del generador es
 * el único sitio donde se puede comprobar QUÉ material recibe el modelo.
 *
 * La comprobación que importa: el `sourceMaterial` con el que se generan los
 * ejercicios contiene texto que salió del PDF subido. Si algún día el
 * recuperador dejara de pasar los fragmentos, el modelo se inventaría la
 * unidad y esta prueba lo diría.
 */

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-28T09:00:00Z");
const TEXTO_DEL_CUADERNO = "El paciente dice me duele la cabeza desde hace tres dias";

const COSTE: GenerationCost = {
  inputTokens: 3000,
  outputTokens: 1200,
  costCents: 94,
  model: "modelo-de-prueba",
};

/** Un PDF real y mínimo (objetos, `xref`, `trailer`), no un mock de `pdf-parse`. */
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> " +
      "/MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
  ];
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  objects.push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

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

/** Almacén en memoria: lo que en producción es S3, aquí es un `Map`. */
function fakeStorage(): ObjectStoragePort & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    put: async ({ key, body }) => void objects.set(key, body),
    delete: async (key) => void objects.delete(key),
  };
}

/**
 * Embeddings deterministas y sin proveedor: un vector de tres componentes
 * derivado de qué palabras del tema aparecen en el texto. Basta para que la
 * cercanía ordene como ordenaría un proveedor real — que es lo único que esta
 * prueba necesita del proveedor.
 */
function fakeEmbeddings(): EmbeddingProviderPort {
  return {
    embed: async (texts) => ({
      vectors: texts.map((text) => {
        const lower = text.toLowerCase();
        return [
          lower.includes("cabeza") ? 1 : 0,
          lower.includes("duele") ? 1 : 0,
          lower.length / 1000,
        ];
      }),
      model: "modelo-de-embeddings-de-prueba",
    }),
  };
}

/** Repositorio de materiales en memoria, con la misma cercanía coseno que hace `pgvector`. */
function inMemoryMaterials(): MaterialRepository & { records: Map<string, MaterialRecord> } {
  const records = new Map<string, MaterialRecord>();
  const chunks = new Map<string, Array<{ chunkIndex: number; text: string; embedding: number[] }>>();

  const cosine = (a: number[], b: number[]): number => {
    const dot = a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
    const norm = (v: number[]) => Math.sqrt(v.reduce((sum, value) => sum + value * value, 0)) || 1;
    return dot / (norm(a) * norm(b));
  };

  return {
    records,
    save: async (params) => {
      records.set(params.id.value, {
        id: params.id,
        schoolId: params.schoolId,
        contentUnitId: null,
        format: params.format,
        originalFilename: params.originalFilename,
        originalStorageKey: params.originalStorageKey,
        originalMimeType: params.originalMimeType,
        originalBytes: params.originalBytes,
        processedStorageKey: null,
        extractedText: null,
        indexedAt: null,
        createdAt: params.now,
      });
    },
    markIndexed: async (params) => {
      const record = records.get(params.materialId.value);
      if (!record) throw new Error("material inexistente en el doble");
      records.set(params.materialId.value, {
        ...record,
        extractedText: params.extractedText,
        processedStorageKey: params.processedStorageKey,
        indexedAt: params.now,
      });
      chunks.set(params.materialId.value, [...params.chunks]);
    },
    findById: async (id) => records.get(id.value) ?? null,
    findRelevantChunks: async ({ materialId, queryEmbedding, limit }): Promise<RelevantChunk[]> =>
      (chunks.get(materialId.value) ?? [])
        .map((chunk) => ({ chunk, score: cosine(chunk.embedding, queryEmbedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ chunk }) => ({ chunkIndex: chunk.chunkIndex, text: chunk.text })),
    linkToContentUnit: async ({ materialId, contentUnitId }) => {
      const record = records.get(materialId.value);
      if (record) records.set(materialId.value, { ...record, contentUnitId });
    },
  };
}

function fakeContentUnits() {
  const saved: ContentUnit[] = [];
  const translations: ContentUnitTranslation[] = [];
  const repository: ContentUnitRepository = {
    save: async (unit) => {
      const index = saved.findIndex((u) => u.id.value === unit.id.value);
      if (index >= 0) saved[index] = unit;
      else saved.push(unit);
    },
    saveTranslation: async (_unit, translation) => void translations.push(translation),
    addExercises: async () => undefined,
    findById: async () => null,
    findRubricIdByCode: async (code) => ({ id: `rubric-${code}`, maxScore: 20 }),
    findExerciseSrsInfo: async () => null,
  };
  return { repository, saved, translations };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeTenant(): TenantContext {
  return { schoolId: () => ESCUELA, membershipId: () => ACTOR, roles: () => ["owner"], has: () => true };
}
function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

describe("de un PDF propio a una unidad hybrid (tarea 14, paso 8, con dobles)", () => {
  it("los ejercicios se generan sobre el texto del PDF subido, no sobre algo inventado", async () => {
    const storage = fakeStorage();
    const materials = inMemoryMaterials();
    const embeddings = fakeEmbeddings();
    const uow = fakeUow();
    const clock: Clock = { now: () => NOW };
    const ids: IdGenerator = { generate: () => randomUUID() };

    // ── 1. Subir el PDF: extracción, troceo e indexado, todo real salvo el
    //       almacén y el proveedor de embeddings.
    const upload = new UploadMaterialHandler(
      materials,
      storage,
      embeddings,
      new TextExtractionAdapter(),
      uow,
      fakeTenant(),
      clock,
      ids,
      fakeLogger(),
    );

    const subida = await upload.execute(
      new UploadMaterialCommand({
        bytes: buildMinimalPdf(TEXTO_DEL_CUADERNO),
        declaredFilename: "cuaderno-b1.pdf",
        declaredMimeType: "application/pdf",
      }),
    );

    expect(subida.indexed).toBe(true);
    expect(subida.format).toBe("pdf");

    // El original se guarda TAL CUAL, y la versión procesada se AÑADE: la
    // escuela puede seguir descargando su fichero.
    const claves = [...storage.objects.keys()];
    expect(claves).toHaveLength(2);
    expect(claves.some((key) => key.endsWith("/original.pdf"))).toBe(true);
    expect(claves.some((key) => key.endsWith("/processed.txt"))).toBe(true);
    expect(storage.objects.get(claves.find((k) => k.endsWith("/original.pdf"))!)!.subarray(0, 5).toString()).toBe(
      "%PDF-",
    );

    // ── 2. Generar la unidad a partir de ese material.
    const contentUnits = fakeContentUnits();
    const aiGenerations: AiGenerationRepository = { record: async () => undefined };
    const creditLedger: CreditLedgerPort = { spend: async () => undefined, refund: async () => undefined };
    const events: EventPublisher = { publish: async () => undefined };

    let sourceMaterialRecibido: string | undefined;
    const generator: ContentGeneratorPort = {
      generateUnit: async (params) => {
        sourceMaterialRecibido = params.sourceMaterial;
        return {
          title: "En la consulta del médico",
          description: "A partir del cuaderno de la escuela.",
          // El doble responde CITANDO lo que recibió: si el manejador no le
          // pasara el material, aquí no habría nada del PDF que citar.
          body: `Según el material de la escuela: ${params.sourceMaterial ?? "(nada)"}`,
          cost: COSTE,
        };
      },
      generateExercises: async ({ unitBody }) => ({
        exercises: [
          {
            type: "cloze",
            prompt: {
              text: "Me duele la {{1}} desde hace tres días.",
              blanks: [{ id: 1 }],
              openEnded: true,
              hint: unitBody,
            },
            solution: { 1: ["cabeza"] },
          },
        ],
        cost: COSTE,
      }),
      correctWriting: async () => {
        throw new Error("no debería llamarse en este doble");
      },
    };

    const generate = new GenerateUnitHandler(
      contentUnits.repository,
      aiGenerations,
      creditLedger,
      generator,
      uow,
      events,
      fakeTenant(),
      clock,
      ids,
      fakeLogger(),
    );

    const commandBus = {
      execute: async (command: GenerateUnitCommand) => generate.execute(command),
    } as unknown as ConstructorParameters<typeof CreateUnitFromMaterialHandler>[2];

    const createFromMaterial = new CreateUnitFromMaterialHandler(
      materials,
      embeddings,
      commandBus,
      uow,
    );

    const resultado = await createFromMaterial.execute(
      new CreateUnitFromMaterialCommand({
        materialId: subida.materialId,
        code: "ES-B1-U20",
        language: "es",
        level: "B1",
        topic: "Me duele la cabeza",
        skills: ["vocabulary"],
        primaryLocale: "es-ES",
        exerciseTypes: ["cloze"],
      }),
    );

    // ── 3. Lo que el brief pide comprobar.
    expect(sourceMaterialRecibido).toContain("me duele la cabeza");
    expect(contentUnits.translations[0]!.body).toContain("me duele la cabeza");

    const unidad = contentUnits.saved[0]!;
    expect(unidad.source).toBe("hybrid");
    // Una unidad `hybrid` nace en revisión, igual que una `ai_generated`: que
    // el material sea de la escuela no salta la firma del profesor.
    expect(unidad.status).toBe("in_review");
    expect(resultado.chunksUsed).toBeGreaterThan(0);

    // El material queda atado a la unidad que salió de él.
    const material = materials.records.get(subida.materialId)!;
    expect(material.contentUnitId).toEqual(ContentUnitId.of(resultado.contentUnitId));
    expect(material.schoolId).toEqual(SchoolId.of(ESCUELA));
    expect(MaterialId.of(subida.materialId).value).toBe(material.id.value);
  });
});
