import type { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import type { ContentUnitId, MaterialId } from "../model/identifiers.js";
import type { MaterialFormat } from "../model/uploaded-material.vo.js";

export type MaterialRecord = {
  id: MaterialId;
  schoolId: SchoolId;
  contentUnitId: ContentUnitId | null;
  format: MaterialFormat;
  originalFilename: string;
  originalStorageKey: string;
  originalMimeType: string;
  originalBytes: number;
  processedStorageKey: string | null;
  extractedText: string | null;
  indexedAt: Date | null;
  createdAt: Date;
};

export type RelevantChunk = { chunkIndex: number; text: string };

/**
 * Persistencia del material propio subido por la escuela (tarea 14 de la
 * ola 2). Vive en `learning`, junto al resto de repositorios del contexto —
 * ninguna otra parte de la aplicación necesita saber que un material existe
 * antes de convertirse en una unidad `hybrid`.
 */
export interface MaterialRepository {
  /** El fichero original ya subido a almacenamiento, todavía sin indexar (`indexedAt: null`). */
  save(params: {
    id: MaterialId;
    schoolId: SchoolId;
    format: MaterialFormat;
    originalFilename: string;
    originalStorageKey: string;
    originalMimeType: string;
    originalBytes: number;
    uploadedByMembershipId: MembershipId | null;
    now: Date;
  }): Promise<void>;

  /**
   * Guarda el resultado de indexar un material: el texto extraído, la
   * versión procesada (nunca sustituye al original) y sus fragmentos con
   * embedding — todo de una vez, para que un material no quede a medio
   * indexar si algo falla a mitad.
   */
  markIndexed(params: {
    materialId: MaterialId;
    extractedText: string;
    processedStorageKey: string;
    processedMimeType: string;
    chunks: Array<{ chunkIndex: number; text: string; embedding: number[] }>;
    now: Date;
  }): Promise<void>;

  findById(id: MaterialId): Promise<MaterialRecord | null>;

  /**
   * Los `limit` fragmentos de ESE material más cercanos (distancia coseno,
   * `pgvector`) al vector de consulta, de más a menos relevante. Es lo que
   * permite generar ejercicios grounded en el material real sin mandar el
   * documento entero al modelo.
   */
  findRelevantChunks(params: {
    materialId: MaterialId;
    queryEmbedding: number[];
    limit: number;
  }): Promise<RelevantChunk[]>;

  /** Asocia el material a la unidad `hybrid` que se creó a partir de él. */
  linkToContentUnit(params: { materialId: MaterialId; contentUnitId: ContentUnitId }): Promise<void>;
}

export const MATERIAL_REPOSITORY = Symbol("MaterialRepository");
