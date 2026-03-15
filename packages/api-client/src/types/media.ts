import type { MediaStatus, ChunkType } from "@langopia/shared/types";
import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface UploadMediaRequest {
  cefrLevel?: string;
  tags?: string;
}

export interface BulkUploadMediaRequest {
  cefrLevel?: string;
}

export interface QueryMediaParams extends PaginationParams {
  search?: string;
  mimeType?: string;
  status?: MediaStatus | string;
  tags?: string;
}

export interface SearchMediaRequest {
  query: string;
  limit?: number;
  mimeType?: string;
  tags?: string[];
}

export interface UpdateMediaRequest {
  tags?: string[];
  detectedTopic?: string;
  detectedCefrLevel?: string;
  detectedLanguage?: string;
}

// ─── Responses ──────────────────────────────────────

export interface MediaPageResponse {
  id: string;
  pageNumber: number;
  imageUrl: string | null;
  extractedText: string | null;
}

export interface MediaChunkResponse {
  id: string;
  chunkType: ChunkType;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  startPage: number;
  endPage: number;
  orderIndex: number;
  createdAt: string;
}

export interface MediaResponse {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  status: MediaStatus;
  cefrLevel: string;
  tags: string[];
  detectedTopic: string | null;
  detectedCefrLevel: string | null;
  detectedLanguage: string | null;
  academyId: string;
  pages?: MediaPageResponse[];
  chunks?: MediaChunkResponse[];
  createdAt: string;
  updatedAt: string;
}
