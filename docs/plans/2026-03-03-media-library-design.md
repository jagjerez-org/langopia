# Media Library Design

**Date**: 2026-03-03
**Status**: Draft

## Overview

A persistent media library where uploaded files (PDF, PPT, images, text, video) are stored in MinIO, analyzed by AI, embedded for semantic search, and reused across exercise generation workflows. Files are scoped per-academy. Duplicate detection via SHA-256 content hash prevents re-uploads and re-analysis.

## Goals

1. **Persist uploaded files** in MinIO/S3 for reuse across sessions
2. **Auto-analyze content**: extract text per page/slide, detect topic/language/CEFR level, generate tags
3. **Embeddings**: per-document and per-page vector embeddings (pgvector) for semantic search
4. **Duplicate detection**: SHA-256 hash — skip re-analysis if same file already exists in academy
5. **Exercise awareness**: alert when similar exercises already exist for the detected topic
6. **Topic auto-detection**: AI suggests topic from content, user can edit before generating exercises
7. **Progress tracking**: per-page processing status for multi-page files (PPT, PDF)
8. **Media Library sidebar**: reusable sidebar component for selecting/uploading files from the Exercise Wizard and other contexts

## Supported File Types

| Type | Extension | Analysis | Storage |
|------|-----------|----------|---------|
| PDF | .pdf | pdf-parse per page | MinIO |
| PowerPoint | .pptx, .ppt | LibreOffice headless → images → GPT-4o Vision per slide | MinIO |
| Image | .jpg, .png, .webp | GPT-4o Vision | MinIO |
| Text | .txt | Direct read | MinIO |
| Video | .mp4, .mov, .webm | None (MVP) — store only | Cloudflare Stream (future) |

## Data Model

### MediaItem (file record)

```
Entity: media_items

id              UUID PK
academyId       UUID FK → academies
uploadedByUserId UUID FK → users
filename        varchar(500)       — original filename
mimeType        varchar(100)       — e.g. "application/pdf"
fileSize        int                — bytes
contentHash     varchar(64)        — SHA-256 hex digest
storageKey      varchar(500)       — MinIO path: "media/{academyId}/{uuid}.ext"
storageUrl      varchar(500)       — full URL

status          varchar(20)        — "pending" | "processing" | "ready" | "failed"
totalPages      int DEFAULT 0      — total pages/slides to process
processedPages  int DEFAULT 0      — progress counter

detectedTopic   varchar(255) NULL  — AI-detected topic
detectedLanguage varchar(10) NULL  — AI-detected language code
detectedCefrLevel varchar(10) NULL — AI-suggested CEFR level
summary         text NULL          — AI-generated 2-3 sentence summary
tags            jsonb DEFAULT []   — AI auto-tags + user edits
embedding       vector(1536) NULL  — document-level embedding

videoStreamId   varchar(255) NULL  — Cloudflare Stream ID (future)
videoDuration   float NULL         — seconds (future)
similarExerciseCount int DEFAULT 0 — cached count of matching exercises

createdAt       timestamptz
updatedAt       timestamptz

UNIQUE(academyId, contentHash)
```

### MediaPage (per-page content)

```
Entity: media_pages

id              UUID PK
mediaItemId     UUID FK → media_items (CASCADE delete)
pageNumber      int                — 1-indexed
extractedText   text               — text from this page/slide
imageUrl        varchar(500) NULL  — S3 URL of slide image (PPT/PDF pages)
embedding       vector(1536) NULL  — page-level embedding

createdAt       timestamptz

UNIQUE(mediaItemId, pageNumber)
```

### Page counts by file type

| File Type | MediaPage records |
|-----------|-------------------|
| Image | 1 (single page) |
| Text (.txt) | 1 (single page) |
| PDF (N pages) | N records (one per page) |
| PPT (N slides) | N records (one per slide) |
| Video | 0 (no analysis in MVP) |

## Enums

```typescript
// In packages/shared/src/types/index.ts

enum MediaStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
}
```

## Upload & Processing Pipeline

### Step 1: Upload

```
Client uploads file(s) via POST /api/v1/media
  → Compute SHA-256 of file buffer
  → Check (academyId, contentHash) uniqueness
    → If exists: return existing MediaItem { duplicate: true }
    → If new:
      1. Upload to MinIO at "media/{academyId}/{uuid}.{ext}"
      2. Create MediaItem(status: "pending", totalPages: estimated)
      3. Fire-and-forget: analyzeMediaItem(id)
      4. Return new MediaItem
```

### Step 2: Background Analysis (`analyzeMediaItem`)

```
1. Set status → "processing"
2. Based on mimeType:
   PDF:
     - pdf-parse to get page count and text per page
     - For each page: create MediaPage(pageNumber, extractedText)
     - Update processedPages after each page
   PPTX:
     - Send to LibreOffice headless sidecar → get images per slide
     - Upload each slide image to MinIO at "media/{academyId}/{uuid}/slide-{n}.png"
     - For each slide image: GPT-4o Vision → extractedText
     - Create MediaPage(pageNumber, extractedText, imageUrl)
     - Update processedPages after each slide
   Image:
     - GPT-4o Vision → extractedText
     - Create MediaPage(pageNumber: 1, extractedText)
     - processedPages = 1
   TXT:
     - Read file text directly
     - Create MediaPage(pageNumber: 1, extractedText)
     - processedPages = 1
   Video:
     - Skip analysis (MVP)
     - status → "ready" immediately

3. Concatenate all page texts → fullText
4. AI analysis call (GPT-4o-mini):
   Input: fullText (truncated to 8000 chars)
   Output: { detectedTopic, detectedLanguage, detectedCefrLevel, summary, tags[] }
5. Generate document embedding from fullText
6. Generate page-level embeddings (batch, fire-and-forget)
7. Semantic search: find similar exercises → cache similarExerciseCount
8. Set status → "ready"
```

### Step 3: Error Handling

- If analysis fails: `status → "failed"`, error logged
- User can retry via `POST /api/v1/media/{id}/retry`
- Retry resets `status → "pending"`, `processedPages → 0`, deletes existing MediaPages, re-runs pipeline

## API Endpoints

### `POST /api/v1/media` — Upload single file

**Auth**: Bearer API key
**Content-Type**: multipart/form-data
**Body**: `file` (binary), optional `tags[]` (string array)
**Response**: `{ data: MediaItem, duplicate: boolean }`

### `POST /api/v1/media/bulk` — Upload multiple files

**Auth**: Bearer API key
**Content-Type**: multipart/form-data
**Body**: `files[]` (multiple binaries), optional `tags[]`
**Response**: `{ data: { mediaItem: MediaItem, duplicate: boolean }[] }`

### `GET /api/v1/media` — List media items

**Auth**: Bearer API key
**Query**: `?tags=grammar,vocabulary&mimeType=application/pdf&status=ready&search=negotiations&limit=20&offset=0`
- `search`: text match on filename, detectedTopic, and tags
- `tags`: comma-separated, matches any
**Response**: `{ data: MediaItem[], total, limit, offset }`

### `GET /api/v1/media/:id` — Get media item with pages

**Auth**: Bearer API key
**Response**: `{ data: MediaItem & { pages: MediaPage[] } }`

### `PATCH /api/v1/media/:id` — Edit metadata

**Auth**: Bearer API key
**Body**: `{ tags?, detectedTopic?, detectedCefrLevel?, detectedLanguage? }`
**Response**: `{ data: MediaItem }`
- Re-embeds if `detectedTopic` changes (fire-and-forget)

### `DELETE /api/v1/media/:id` — Delete media item

**Auth**: Bearer API key
- Deletes from DB (MediaItem + MediaPages cascade)
- Deletes file + slide images from MinIO
**Response**: `{ deleted: true }`

### `POST /api/v1/media/:id/retry` — Retry failed analysis

**Auth**: Bearer API key
- Only works if status = "failed"
- Resets state and re-runs pipeline
**Response**: `{ data: MediaItem }`

### `POST /api/v1/media/search` — Semantic search

**Auth**: Bearer API key
**Body**: `{ query: string, limit?: number, mimeType?: string, tags?: string[] }`
**Response**: `{ data: MediaItem[], total, tokensUsed }`
- Generates embedding for query, cosine distance search against media_items.embedding

## UI Design

### Dashboard Page: `/dashboard/media`

**List view** with:
- Search bar (text match on filename, topic, tags)
- Filters: file type (PDF, PPT, Image, Text, Video), tags, CEFR level, status
- Grid/list of media items showing: thumbnail/icon, filename, topic, tags, page count, status, processing progress
- Contextual menu: View Details, Edit Tags, Generate Exercises, Delete

### Detail Page: `/dashboard/media/[id]`

- File metadata: name, size, upload date, uploader
- Editable fields: tags (chip input), topic, language, CEFR level
- AI summary
- Page list (accordion/collapsible): page number, extracted text, slide image preview
- Alert banner: "N exercises already exist about [topic]" with link to exercise bank filtered by topic
- Action button: "Generate Exercises" → opens Exercise Wizard pre-filled

### Media Library Sidebar Component

A reusable `<MediaLibrarySidebar>` (Sheet from right) that can be opened from:
- Exercise Wizard (Step 1)
- Lesson detail page
- Any context that needs file selection

**Sidebar contents**:
- Tab 1: **Browse** — search + filter existing media items, click to select
- Tab 2: **Upload** — dropzone to upload new files, shows progress, auto-selects when ready
- Footer: "Select" button to confirm selection and close sidebar

**On select**: returns `{ mediaItemId, extractedText (concatenated), detectedTopic, detectedLanguage, detectedCefrLevel, similarExerciseCount }`

### Exercise Wizard Integration

**Current**: Step 1 has a file dropzone + topic input
**New**: Step 1 has:
- Button: "Open Media Library" → opens sidebar
- When file selected from sidebar:
  - Topic field pre-filled with `detectedTopic` (editable)
  - Language pre-filled with `detectedLanguage`
  - CEFR level pre-filled with `detectedCefrLevel`
  - `materialContext` set to concatenated extractedText
  - If `similarExerciseCount > 0`: show alert banner "N exercises already exist about this topic — View"
- No direct file upload in the wizard — always goes through Media Library

## Infrastructure

### LibreOffice Headless (Docker sidecar)

Added to `docker-compose.yml`:

```yaml
libreoffice:
  image: linuxserver/libreoffice
  # Or a lightweight headless image
  container_name: langopia-libreoffice
  restart: unless-stopped
  # Expose a simple HTTP API or use exec-based conversion
  volumes:
    - /tmp/libreoffice-work:/tmp/work
```

**Conversion flow**:
1. Save uploaded PPTX to shared volume
2. Run `libreoffice --headless --convert-to png --outdir /tmp/work/output /tmp/work/input.pptx`
3. Read generated PNG files (one per slide)
4. Upload each PNG to MinIO
5. Clean up temp files

### MinIO Storage Layout

```
langopia-recordings/
├── recordings/          — room recordings (existing)
├── tts/                 — exercise audio (existing)
├── media/               — media library files (NEW)
│   └── {academyId}/
│       ├── {uuid}.pdf
│       ├── {uuid}.pptx
│       ├── {uuid}/      — slide images for PPT
│       │   ├── slide-1.png
│       │   ├── slide-2.png
│       │   └── ...
│       └── {uuid}.jpg
```

### Database Indexes

```sql
-- HNSW indexes for vector search
CREATE INDEX IF NOT EXISTS idx_media_items_embedding_hnsw
ON media_items USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_media_pages_embedding_hnsw
ON media_pages USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query performance
CREATE INDEX idx_media_items_academy_status ON media_items("academyId", "status");
CREATE INDEX idx_media_items_content_hash ON media_items("academyId", "contentHash");
```

## Usage Tracking

- **AI_TOKENS**: embedding generation (document + pages) + topic/tag detection + GPT-4o Vision for image/slide extraction
- **STORAGE_BYTES**: file size stored in MinIO (tracked on upload, decremented on delete)
- Plan limits enforced before upload (storage) and before analysis (AI tokens)

## Implementation Files

| # | File | Action |
|---|------|--------|
| 1 | `docker-compose.yml` | MODIFY — add LibreOffice headless sidecar |
| 2 | `apps/web/src/entities/index.ts` | MODIFY — add MediaItem + MediaPage entities |
| 3 | `packages/shared/src/types/index.ts` | MODIFY — add MediaStatus enum |
| 4 | `apps/web/scripts/db-sync.ts` | MODIFY — add HNSW indexes for media embeddings |
| 5 | `apps/web/src/lib/media-processing.ts` | CREATE — analysis pipeline |
| 6 | `apps/web/src/lib/pptx-converter.ts` | CREATE — PPT → images via LibreOffice |
| 7 | `apps/web/src/lib/file-extract.ts` | MODIFY — refactor for per-page extraction |
| 8 | `apps/web/src/app/api/v1/media/route.ts` | CREATE — POST (upload), GET (list) |
| 9 | `apps/web/src/app/api/v1/media/bulk/route.ts` | CREATE — POST (bulk upload) |
| 10 | `apps/web/src/app/api/v1/media/[id]/route.ts` | CREATE — GET, PATCH, DELETE |
| 11 | `apps/web/src/app/api/v1/media/[id]/retry/route.ts` | CREATE — POST (retry) |
| 12 | `apps/web/src/app/api/v1/media/search/route.ts` | CREATE — POST (semantic search) |
| 13 | `apps/web/src/components/media-library-sidebar.tsx` | CREATE — reusable sidebar |
| 14 | `apps/web/src/app/(dashboard)/dashboard/media/page.tsx` | CREATE — media library page |
| 15 | `apps/web/src/app/(dashboard)/dashboard/media/[id]/page.tsx` | CREATE — media detail page |
| 16 | `apps/web/src/components/exercise-wizard.tsx` | MODIFY — replace dropzone with Media Library button |
| 17 | `apps/web/next.config.ts` | MODIFY — add packages to serverExternalPackages |
| 18 | `apps/web/scripts/backfill-media-embeddings.ts` | CREATE — backfill script |

## Implementation Order

1. **Phase 1 — Data layer**: Entities, enums, db-sync, docker (LibreOffice)
2. **Phase 2 — Processing pipeline**: file-extract refactor, pptx-converter, media-processing
3. **Phase 3 — API endpoints**: upload, list, detail, edit, delete, retry, search, bulk
4. **Phase 4 — UI**: media library page, detail page, sidebar component
5. **Phase 5 — Integration**: modify exercise wizard, wire up sidebar
