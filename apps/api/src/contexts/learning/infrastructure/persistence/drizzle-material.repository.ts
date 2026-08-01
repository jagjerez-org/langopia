import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { ContentUnitId, MaterialId } from "../../domain/model/identifiers.js";
import type { MaterialFormat } from "../../domain/model/uploaded-material.vo.js";
import type {
  MaterialRecord,
  MaterialRepository,
  RelevantChunk,
} from "../../domain/ports/material.repository.port.js";

/** Literal de texto que espera `pgvector` por cable: `[0.1,0.2,...]`. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

@Injectable()
export class DrizzleMaterialRepository implements MaterialRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async save(params: {
    id: MaterialId;
    schoolId: SchoolId;
    format: MaterialFormat;
    originalFilename: string;
    originalStorageKey: string;
    originalMimeType: string;
    originalBytes: number;
    uploadedByMembershipId: MembershipId | null;
    now: Date;
  }): Promise<void> {
    await this.drizzle.db.insert(schema.contentMaterials).values({
      id: params.id.value,
      schoolId: params.schoolId.value,
      format: params.format,
      originalFilename: params.originalFilename,
      originalStorageKey: params.originalStorageKey,
      originalMimeType: params.originalMimeType,
      originalBytes: params.originalBytes,
      uploadedByMembershipId: params.uploadedByMembershipId?.value ?? null,
      createdAt: params.now,
    });
  }

  async markIndexed(params: {
    materialId: MaterialId;
    extractedText: string;
    processedStorageKey: string;
    processedMimeType: string;
    chunks: Array<{ chunkIndex: number; text: string; embedding: number[] }>;
    now: Date;
  }): Promise<void> {
    const rows = await this.drizzle.db
      .select({ schoolId: schema.contentMaterials.schoolId })
      .from(schema.contentMaterials)
      .where(eq(schema.contentMaterials.id, params.materialId.value))
      .limit(1);
    const schoolId = rows[0]?.schoolId;
    if (!schoolId) return;

    await this.drizzle.db
      .update(schema.contentMaterials)
      .set({
        extractedText: params.extractedText,
        processedStorageKey: params.processedStorageKey,
        processedMimeType: params.processedMimeType,
        indexedAt: params.now,
      })
      .where(eq(schema.contentMaterials.id, params.materialId.value));

    if (params.chunks.length === 0) return;

    await this.drizzle.db.insert(schema.contentMaterialChunks).values(
      params.chunks.map((chunk) => ({
        schoolId,
        materialId: params.materialId.value,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding: chunk.embedding,
      })),
    );
  }

  async findById(id: MaterialId): Promise<MaterialRecord | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.contentMaterials)
      .where(eq(schema.contentMaterials.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    return {
      id: MaterialId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      contentUnitId: row.contentUnitId ? ContentUnitId.of(row.contentUnitId) : null,
      format: row.format,
      originalFilename: row.originalFilename,
      originalStorageKey: row.originalStorageKey,
      originalMimeType: row.originalMimeType,
      originalBytes: row.originalBytes,
      processedStorageKey: row.processedStorageKey,
      extractedText: row.extractedText,
      indexedAt: row.indexedAt,
      createdAt: row.createdAt,
    };
  }

  async findRelevantChunks(params: {
    materialId: MaterialId;
    queryEmbedding: number[];
    limit: number;
  }): Promise<RelevantChunk[]> {
    const literal = toVectorLiteral(params.queryEmbedding);
    const rows = await this.drizzle.db
      .select({
        chunkIndex: schema.contentMaterialChunks.chunkIndex,
        text: schema.contentMaterialChunks.text,
      })
      .from(schema.contentMaterialChunks)
      .where(eq(schema.contentMaterialChunks.materialId, params.materialId.value))
      .orderBy(sql`${schema.contentMaterialChunks.embedding} <=> ${literal}::vector`)
      .limit(params.limit);
    return rows;
  }

  async linkToContentUnit(params: { materialId: MaterialId; contentUnitId: ContentUnitId }): Promise<void> {
    await this.drizzle.db
      .update(schema.contentMaterials)
      .set({ contentUnitId: params.contentUnitId.value })
      .where(eq(schema.contentMaterials.id, params.materialId.value));
  }
}
