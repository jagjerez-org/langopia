# Lessons + Exercise Bank Design

**Date:** 2026-03-02
**Status:** Approved

## Overview

Replace the current standalone Exercises page with a **Lessons** system and reposition exercises as a **bank** (reusable library). Teachers create lessons with pre-class exercises. Post-class exercises are generated per-student as part of AI reports. All exercises live in the bank regardless of origin.

## Data Model

### New Entity: Lesson

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| academyId | FK → Academy | Multi-tenancy |
| title | string(255) | |
| description | text, nullable | |
| language | string(10) | en, es, fr, etc. |
| cefrLevel | string(10) | A1–C2 |
| topic | string(255), nullable | Context for AI generation |
| status | enum(LessonStatus) | draft / ready / completed |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

### New Entity: LessonExercise (join table)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| lessonId | FK → Lesson | |
| exerciseId | FK → Exercise | |
| sortOrder | int, default 0 | Ordering within lesson |
| createdAt | timestamptz | |

Unique constraint on (lessonId, exerciseId).

### New Entity: ReportExercise (join table)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| reportId | FK → ClassReport | |
| studentId | FK → Student | |
| exerciseId | FK → Exercise | |
| isCompleted | boolean, default false | |
| isCorrect | boolean, nullable | |
| studentAnswer | text, nullable | |
| createdAt | timestamptz | |

### Modified Entity: Exercise

Remove fields (context now lives in join tables):
- `studentId` (FK) → removed
- `roomId` (FK) → removed
- `isCompleted` → removed
- `isCorrect` → removed
- `studentAnswer` → removed

Keep all content fields: type, targetSkill, topic, language, cefrLevel, instruction, content, options, correctAnswer, explanation, audioUrl, templateId, source.

Exercise becomes a **pure content item** in the bank. Context is provided by LessonExercise (pre-class) and ReportExercise (post-class per-student).

### Modified Entity: Room

Add optional field:
- `lessonId` FK → Lesson, nullable

When a room is created with a lessonId, the post-class pipeline uses that lesson's context to generate report exercises.

### New Shared Types

```ts
enum LessonStatus {
  DRAFT = "draft",
  READY = "ready",
  COMPLETED = "completed",
}
```

## API Endpoints

### Lessons CRUD

All authenticated via Bearer apiKey.

| Method | Path | Body/Params | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/lessons` | ?language, ?cefrLevel, ?status, ?limit, ?offset | { data: Lesson[], total } |
| POST | `/api/v1/lessons` | { title, language, cefrLevel, topic?, description? } | Lesson |
| GET | `/api/v1/lessons/:id` | — | Lesson + exerciseCount |
| PATCH | `/api/v1/lessons/:id` | { title?, description?, topic?, status? } | Lesson |
| DELETE | `/api/v1/lessons/:id` | — | 204 (deletes LessonExercise links, not the exercises) |

### Lesson Exercises

| Method | Path | Body/Params | Response |
|--------|------|-------------|----------|
| POST | `/api/v1/lessons/:id/exercises` | { templates: [{templateId, count}], topic? } + optional files | { generated: Exercise[], reused: Exercise[] } |
| GET | `/api/v1/lessons/:id/exercises` | ?limit, ?offset | { data: Exercise[], total } |
| DELETE | `/api/v1/lessons/:id/exercises/:exerciseId` | — | 204 (unlinks from lesson, exercise stays in bank) |

POST generate flow:
1. Load lesson (language, cefrLevel, topic)
2. Search bank for matching exercises (same language, cefrLevel, topic, skill)
3. Reuse matching ones (link via LessonExercise)
4. Generate new ones for remaining count (add to bank + link)
5. Return both reused and generated

### Room Creation (modified)

`POST /api/v1/rooms` — add optional `lessonId` field. Validated that lesson belongs to same academy.

### Existing Exercise Bank Endpoints (kept)

- `GET /api/v1/exercises` — list all bank exercises (full library)
- `POST /api/v1/exercises` — create standalone exercises (manual bank additions)
- `GET /api/v1/exercises/:id` — get exercise detail
- `PATCH /api/v1/exercises/:id` — edit exercise content
- `DELETE /api/v1/exercises/:id` — delete from bank (cascades LessonExercise/ReportExercise links)

## Dashboard UI

### Sidebar Navigation

Replace "Exercises" with "Lessons" in academy-scoped nav:

```
Rooms, Reports, Students, Lessons, API Keys
```

Exercise Bank accessible from within Lessons page (secondary nav or tab).

### Lessons List Page (`/dashboard/lessons`)

- Top bar: "New Lesson" button + filters (language, CEFR level, status)
- Cards grouped by language, each showing:
  - Title, language badge, CEFR badge, status badge
  - Exercise count, linked rooms count
  - Created date
- Empty state: prompt to create first lesson

### Lesson Detail Page (`/dashboard/lessons/[id]`)

- Header: title (editable), language, CEFR level, topic, description, status toggle
- Exercise generator section: template picker, topic (pre-filled from lesson), file upload, generate button
- Exercise list: cards with preview, edit, delete (unlink), regenerate, audio player
- Uses same exercise card components as current Exercises page

### Exercise Bank Page (`/dashboard/exercises`)

- Redirects to `/dashboard/lessons` OR stays as a secondary view showing the flat exercise library
- Useful for browsing/searching all exercises across lessons
- Filter by language, CEFR, skill, type, source

### Reports Page (modified)

- Room report detail shows per-student sections
- Each student section includes their personalized post-class exercises (from ReportExercise)
- Student can answer exercises; progress tracked in ReportExercise

## Post-Class Pipeline (modified)

When a room with `lessonId` ends:

1. Existing flow: transcription → ClassReport per student
2. New: for each student, generate personalized exercises based on weaknesses
3. Add exercises to bank (source: AI_REPORT)
4. Link via ReportExercise (reportId, studentId, exerciseId)
5. AI can also reuse existing bank exercises if they match student needs

## Implementation Order

### Phase 1: Data Model
1. Add Lesson, LessonExercise, ReportExercise entities to `entities/index.ts`
2. Add LessonStatus enum to `shared/types/index.ts`
3. Remove studentId, roomId, isCompleted, isCorrect, studentAnswer from Exercise
4. Add lessonId to Room entity
5. Sync schema

### Phase 2: Lesson API
6. Create `/api/v1/lessons/route.ts` (GET + POST)
7. Create `/api/v1/lessons/[id]/route.ts` (GET + PATCH + DELETE)
8. Create `/api/v1/lessons/[id]/exercises/route.ts` (POST generate + GET list + DELETE unlink)
9. Modify `/api/v1/rooms/route.ts` to accept lessonId

### Phase 3: Dashboard UI
10. Create `/dashboard/lessons/page.tsx` (list)
11. Create `/dashboard/lessons/[id]/page.tsx` (detail + exercise generator)
12. Update sidebar: Exercises → Lessons
13. Redirect `/dashboard/exercises` → `/dashboard/lessons`

### Phase 4: Adapt existing exercise endpoints
14. Update `GET/POST /api/v1/exercises` for bank-only model (no student/room context)
15. Update `PATCH/DELETE /api/v1/exercises/:id` (cascade join table cleanup)

### Phase 5: Post-class pipeline
16. Modify `post-class-pipeline.ts` to generate ReportExercise links
17. Update Reports UI to show per-student exercises
