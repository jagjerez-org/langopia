import type { CommandBus } from "@nestjs/cqrs";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MaterialNotIndexedError } from "../../../domain/errors/learning.errors.js";
import { MaterialId } from "../../../domain/model/identifiers.js";
import type { EmbeddingProviderPort } from "../../../domain/ports/embedding-provider.port.js";
import type {
  MaterialRecord,
  MaterialRepository,
  RelevantChunk,
} from "../../../domain/ports/material.repository.port.js";
import { GenerateUnitCommand } from "../generate-unit/generate-unit.command.js";
import { CreateUnitFromMaterialCommand } from "./create-unit-from-material.command.js";
import {
  CreateUnitFromMaterialHandler,
  RELEVANT_CHUNKS_FOR_GENERATION,
  buildRetrievalQuery,
  buildSourceMaterial,
} from "./create-unit-from-material.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const MATERIAL = "33333333-3333-4333-8333-333333333333";
const UNIDAD = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-07-28T09:00:00Z");

function fakeUow(): UnitOfWork {
  return {
    execute: async <T>(work: () => Promise<T>) => work(),
    read: async <T>(work: () => Promise<T>) => work(),
  } as UnitOfWork;
}

function materialRecord(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    id: MaterialId.of(MATERIAL),
    schoolId: SchoolId.of(ESCUELA),
    contentUnitId: null,
    format: "pdf",
    originalFilename: "cuaderno-b1.pdf",
    originalStorageKey: `${ESCUELA}/materials/${MATERIAL}/original.pdf`,
    originalMimeType: "application/pdf",
    originalBytes: 4096,
    processedStorageKey: `${ESCUELA}/materials/${MATERIAL}/processed.txt`,
    extractedText: "En la consulta del médico se usa «me duele» y «desde hace».",
    indexedAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function fakeMaterials(params: {
  record: MaterialRecord | null;
  chunks?: RelevantChunk[];
}): MaterialRepository & { links: unknown[]; chunkQueries: unknown[] } {
  const links: unknown[] = [];
  const chunkQueries: unknown[] = [];
  return {
    links,
    chunkQueries,
    save: async () => undefined,
    markIndexed: async () => undefined,
    findById: async () => params.record,
    findRelevantChunks: async (query) => {
      chunkQueries.push(query);
      return params.chunks ?? [];
    },
    linkToContentUnit: async (link) => void links.push(link),
  };
}

function fakeEmbeddings(): EmbeddingProviderPort & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    embed: async (texts) => {
      calls.push(texts);
      return { vectors: texts.map(() => [0.1, 0.2, 0.3]), model: "test-embedding-model" };
    },
  };
}

function fakeCommandBus(): CommandBus & { executed: unknown[] } {
  const executed: unknown[] = [];
  return {
    executed,
    execute: async (command: unknown) => {
      executed.push(command);
      return { contentUnitId: UNIDAD, status: "in_review" };
    },
  } as unknown as CommandBus & { executed: unknown[] };
}

function comando(): CreateUnitFromMaterialCommand {
  return new CreateUnitFromMaterialCommand({
    materialId: MATERIAL,
    code: "ES-B1-U09",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["vocabulary", "grammar"],
    primaryLocale: "es-ES",
    exerciseTypes: ["cloze", "multiple_choice"],
  });
}

const CHUNKS: RelevantChunk[] = [
  { chunkIndex: 0, text: "Me duele la cabeza desde hace tres días." },
  { chunkIndex: 4, text: "El médico pregunta: ¿desde cuándo tiene estos síntomas?" },
];

describe("CreateUnitFromMaterialHandler", () => {
  it("genera una unidad hybrid con los fragmentos del material como fuente", async () => {
    const materials = fakeMaterials({ record: materialRecord(), chunks: CHUNKS });
    const embeddings = fakeEmbeddings();
    const commands = fakeCommandBus();
    const handler = new CreateUnitFromMaterialHandler(materials, embeddings, commands, fakeUow());

    const result = await handler.execute(comando());

    expect(result).toEqual({
      contentUnitId: UNIDAD,
      status: "in_review",
      materialId: MATERIAL,
      chunksUsed: 2,
    });

    const [dispatched] = commands.executed as GenerateUnitCommand[];
    expect(dispatched).toBeInstanceOf(GenerateUnitCommand);
    expect(dispatched!.props.source).toBe("hybrid");
    expect(dispatched!.props.sourceMaterial).toContain("Me duele la cabeza desde hace tres días.");
    expect(dispatched!.props.sourceMaterial).toContain(
      "El médico pregunta: ¿desde cuándo tiene estos síntomas?",
    );
  });

  it("busca los fragmentos por cercanía al tema y las destrezas pedidas, no al azar", async () => {
    const materials = fakeMaterials({ record: materialRecord(), chunks: CHUNKS });
    const embeddings = fakeEmbeddings();
    const handler = new CreateUnitFromMaterialHandler(
      materials,
      embeddings,
      fakeCommandBus(),
      fakeUow(),
    );

    await handler.execute(comando());

    expect(embeddings.calls).toEqual([["En la consulta del médico (vocabulary, grammar)"]]);
    expect(materials.chunkQueries).toEqual([
      {
        materialId: MaterialId.of(MATERIAL),
        queryEmbedding: [0.1, 0.2, 0.3],
        limit: RELEVANT_CHUNKS_FOR_GENERATION,
      },
    ]);
  });

  it("ata el material a la unidad que salió de él", async () => {
    const materials = fakeMaterials({ record: materialRecord(), chunks: CHUNKS });
    const handler = new CreateUnitFromMaterialHandler(
      materials,
      fakeEmbeddings(),
      fakeCommandBus(),
      fakeUow(),
    );

    await handler.execute(comando());

    expect(materials.links).toHaveLength(1);
    expect((materials.links[0] as { contentUnitId: { value: string } }).contentUnitId.value).toBe(UNIDAD);
  });

  it("un material que no existe no genera nada", async () => {
    const commands = fakeCommandBus();
    const handler = new CreateUnitFromMaterialHandler(
      fakeMaterials({ record: null }),
      fakeEmbeddings(),
      commands,
      fakeUow(),
    );

    await expect(handler.execute(comando())).rejects.toBeInstanceOf(NotFoundError);
    expect(commands.executed).toEqual([]);
  });

  it("un material sin indexar (un mp3, o un pdf cuya indexación falló) se rechaza antes de gastar nada", async () => {
    const commands = fakeCommandBus();
    const embeddings = fakeEmbeddings();
    const handler = new CreateUnitFromMaterialHandler(
      fakeMaterials({ record: materialRecord({ indexedAt: null, extractedText: null }) }),
      embeddings,
      commands,
      fakeUow(),
    );

    await expect(handler.execute(comando())).rejects.toBeInstanceOf(MaterialNotIndexedError);
    expect(embeddings.calls).toEqual([]);
    expect(commands.executed).toEqual([]);
  });

  it("sin fragmentos relevantes no se genera una unidad que no citaría el material", async () => {
    const commands = fakeCommandBus();
    const handler = new CreateUnitFromMaterialHandler(
      fakeMaterials({ record: materialRecord(), chunks: [] }),
      fakeEmbeddings(),
      commands,
      fakeUow(),
    );

    await expect(handler.execute(comando())).rejects.toBeInstanceOf(MaterialNotIndexedError);
    expect(commands.executed).toEqual([]);
  });

  it("los fragmentos van numerados y separados en el material de partida", () => {
    expect(buildSourceMaterial(CHUNKS)).toBe(
      "[fragmento 1]\nMe duele la cabeza desde hace tres días.\n\n" +
        "[fragmento 5]\nEl médico pregunta: ¿desde cuándo tiene estos síntomas?",
    );
  });

  it("sin destrezas, la búsqueda es solo el tema", () => {
    expect(buildRetrievalQuery("En la consulta del médico", [])).toBe("En la consulta del médico");
  });
});
