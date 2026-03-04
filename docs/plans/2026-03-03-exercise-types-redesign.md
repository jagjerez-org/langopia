# Exercise Types Redesign

## Summary

Replace the current 6 generic exercise types + dynamic template system with 11 fixed interactive exercise types. Each type has a hardcoded AI prompt, a defined content structure using existing DB fields, and a fully interactive preview component in the dashboard. Templates are eliminated entirely; teachers customize generation via the `customPrompt` feature on regeneration.

## Exercise Types (Fixed Catalog)

| Slug | Name | Description |
|------|------|-------------|
| `warm_up` | Warm Up | Free text exercise from text, audio, or video. Media attachable after creation. |
| `intro` | Introduction | Presentation screen for topic/structure overview. Read-only. |
| `card` | Concept Card | Grammar/concept card with structure and examples. Read-only. |
| `tap_to_complete` | Tap to Complete | Complete a sentence/phrase by tapping the correct option from choices. |
| `tap_to_order` | Tap to Order | Reorder shuffled words by tapping to form a correct sentence. |
| `listen_match` | Listen & Match | Listen to audio and match items (image or text pairs). |
| `listen_repeat` | Listen & Repeat | Listen to audio and record yourself repeating it. |
| `watch_reflect` | Watch & Reflect | Watch a video and write a reflection (pre/post class). |
| `complete_chat` | Complete Chat | Fill in blanks within a chat conversation by selecting responses. |
| `write_complete` | Write to Complete | Type words/phrases to fill blanks in text. |
| `listen_complete` | Listen & Complete | Listen to audio and complete a conversation with blanks. |

## Data Model Changes

### ExerciseType Enum (replace current)

```typescript
enum ExerciseType {
  WARM_UP = "warm_up",
  INTRO = "intro",
  CARD = "card",
  TAP_TO_COMPLETE = "tap_to_complete",
  TAP_TO_ORDER = "tap_to_order",
  LISTEN_MATCH = "listen_match",
  LISTEN_REPEAT = "listen_repeat",
  WATCH_REFLECT = "watch_reflect",
  COMPLETE_CHAT = "complete_chat",
  WRITE_COMPLETE = "write_complete",
  LISTEN_COMPLETE = "listen_complete",
}
```

### Exercise Entity Changes

**Add fields:**
- `title` — varchar(255), nullable. Display title of the exercise.
- `videoUrl` — varchar(500), nullable. URL for video content.
- `imageUrl` — varchar(500), nullable. URL for image content.

**Remove fields:**
- `templateId` — FK to ExerciseTemplate (no longer needed).

**Keep unchanged:**
- `type`, `targetSkill`, `topic`, `language`, `instruction`, `content`, `options` (jsonb), `correctAnswer`, `explanation`, `cefrLevel`, `audioUrl`, `embedding`, `source`, `academyId`, timestamps.

### Remove Entities

- **ExerciseTemplate** — Delete entity entirely.
- Remove `template` relation from Exercise.
- Remove `exercises` relation from ExerciseTemplate (cascade).

### Remove Endpoints

- `GET/POST /api/v1/exercises/templates`
- `PATCH/DELETE /api/v1/exercises/templates/[id]`

## Content Structure Per Type

How each exercise type maps to existing fields:

### warm_up
- `title`: "Vocabulary Warm-up" (optional)
- `instruction`: "Read the text and write your response"
- `content`: Main text passage
- `options`: null
- `correctAnswer`: Model answer
- `audioUrl`: Optional audio version
- `videoUrl`: Optional video
- `imageUrl`: null

### intro
- `title`: Topic title (e.g. "Present Simple")
- `instruction`: Brief description of what to review
- `content`: Structured topic explanation
- `options`: null
- `correctAnswer`: null
- `audioUrl`: null
- `videoUrl`: null
- `imageUrl`: Optional decorative image

### card
- `title`: Concept name (e.g. "Irregular Verbs")
- `instruction`: Short description
- `content`: Explanation with examples
- `options`: null
- `correctAnswer`: null
- `audioUrl`: Optional pronunciation audio
- `videoUrl`: null
- `imageUrl`: Optional illustrative image

### tap_to_complete
- `title`: Short title (optional)
- `instruction`: "Tap the correct option to complete the sentence"
- `content`: Sentence with `___` blanks (e.g. "She ___ to school every day")
- `options`: `["goes", "go", "going", "gone"]` — tappable choices
- `correctAnswer`: "goes"
- `explanation`: Grammar rule explanation

### tap_to_order
- `title`: Short title (optional)
- `instruction`: "Put the words in the correct order"
- `content`: The correct sentence (reference, hidden from student)
- `options`: `["go", "I", "school", "to"]` — shuffled words
- `correctAnswer`: "I go to school"
- `explanation`: Why this order is correct

### listen_match
- `title`: Short title (optional)
- `instruction`: "Listen and match the items"
- `content`: Description of matching pairs (text-based representation)
- `options`: `["apple", "cat", "house"]` — items to match
- `correctAnswer`: Correct mapping (JSON string of pairs)
- `audioUrl`: Audio for the exercise
- `imageUrl`: Optional image

### listen_repeat
- `title`: Short title (optional)
- `instruction`: "Listen and repeat the phrase"
- `content`: Text to be spoken/repeated
- `options`: null
- `correctAnswer`: The exact text (same as content)
- `audioUrl`: Model pronunciation audio

### watch_reflect
- `title`: Short title (optional)
- `instruction`: "Watch the video and answer the question"
- `content`: Reflection question/prompt
- `options`: null
- `correctAnswer`: Model answer
- `videoUrl`: Video URL (required)

### complete_chat
- `title`: Short title (optional)
- `instruction`: "Complete the conversation"
- `content`: Chat conversation with `___` blanks in messages
- `options`: `["Hi!", "Sure", "Thanks"]` — selectable responses
- `correctAnswer`: Correct responses (JSON string or ordered)
- `explanation`: Why these responses fit

### write_complete
- `title`: Short title (optional)
- `instruction`: "Write the missing words to complete the text"
- `content`: Text with `___` blanks
- `options`: null (free typing)
- `correctAnswer`: Correct words/phrases
- `explanation`: Why these words are correct

### listen_complete
- `title`: Short title (optional)
- `instruction`: "Listen and complete the conversation"
- `content`: Conversation text with `___` blanks
- `options`: `["hello", "goodbye"]` — selectable options
- `correctAnswer`: Correct responses
- `audioUrl`: Audio of the conversation

## AI Generation

### Approach

Each exercise type has a hardcoded prompt in the backend (in the ai-pipeline package or in the route handler). No ExerciseTemplate table.

### Generation Flow

1. Wizard sends: `{ exercises: [{type: "tap_to_complete", count: 2}, ...], topic, language, cefrLevel, materialContext? }`
2. Backend loads hardcoded prompt for each type
3. Interpolates variables: `{{topic}}`, `{{language}}`, `{{cefrLevel}}`, `{{count}}`, `{{materialContext}}`
4. If `customPrompt` is provided (regeneration), appends as "ADDITIONAL INSTRUCTIONS FROM TEACHER"
5. **Embedding dedup**: Before generating, searches existing exercises by embedding similarity on topic/material. Passes similar exercises to prompt as "DO NOT generate exercises similar to these: [list]"
6. Calls GPT-4o-mini with JSON response format
7. Parses response, saves exercises, generates TTS if needed, generates embeddings

### Prompt Structure (per type)

Each prompt follows this structure:
```
You are a language exercise generator. Create a "{{typeName}}" exercise.

Topic: {{topic}}
Language: {{language}}
CEFR Level: {{cefrLevel}}
{{#materialContext}}Based on this source material: {{materialContext}}{{/materialContext}}

{{#existingExercises}}
IMPORTANT: Do NOT generate exercises similar to these existing ones:
{{existingExercises}}
{{/existingExercises}}

[Type-specific instructions and JSON format]

{{#customPrompt}}
ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}
{{/customPrompt}}
```

### Analysis Endpoint

`POST /api/v1/exercises/analyze` — Updated to suggest from the 11 fixed types instead of dynamic templates. Returns:
```json
{
  "detectedTopic": "Business English",
  "materialSummary": "...",
  "suggestions": [
    { "type": "tap_to_complete", "count": 3, "reason": "Good for practicing vocabulary in context" },
    { "type": "listen_repeat", "count": 2, "reason": "Helps with pronunciation of key terms" }
  ]
}
```

No more `proposedTemplates` in the response.

## Wizard Changes

### Step 1 — Material & Topic (unchanged)
- Topic input, Language select, CEFR Level select
- Media Library button (optional source material)
- "Analyze & Suggest" button

### Step 2 — Exercise Plan (simplified)
- AI returns suggestions from the 11 fixed types with counts
- All 11 types shown as a list with icon, name, description
- Suggested types have count > 0; others start at 0
- Professor adjusts with +/- buttons (0–10 per type)
- **Removed**: "Proposed New Types" section
- **Removed**: "Browse & Reuse Existing Exercises" section
- "Generate X Exercises" button

### Step 3 — Review & Save (enhanced)
- List of generated exercises with interactive preview inline
- Checkbox to select/deselect each
- Regenerate button opens `RegenerateDialog` (custom prompt support)
- "Save" button

## Interactive Preview Components

11 React components for the dashboard. Used in Exercise Bank, Lesson Detail, and Wizard Step 3.

| Type | Interaction |
|------|-------------|
| `warmUp` | Show text/audio/video + textarea for free response. "Show model answer" button. |
| `intro` | Visual screen with title, structured content, image. Read-only. |
| `card` | Flip-style or expandable card with concept + examples. Read-only. |
| `tapToComplete` | Sentence with blanks, tappable option buttons. Tap fills blank. Green/red feedback. |
| `tapToOrder` | Shuffled word chips/buttons. Tap to add to sentence. Reorder by tapping. |
| `listenMatch` | Play audio + tappable/draggable items to match pairs. Connection lines. |
| `listenRepeat` | Play audio + record button (MediaRecorder API). Visual comparison. |
| `watchReflect` | Video player + textarea for reflection. "Show model answer" button. |
| `completeChat` | Chat bubble UI with blanks. Tappable options to fill each blank. |
| `writeComplete` | Text with inline input fields in blanks. Validation on submit. |
| `listenComplete` | Audio player + conversation with blanks + tappable options. |

All interactive components share:
- States: "not started" → "in progress" → "completed"
- Immediate feedback (correct/incorrect)
- "Show answer" button to reveal correct answer
- "Reset" button to retry

### Component File Structure

```
apps/web/src/components/exercises/
  exercise-renderer.tsx      # Routes exercise to correct component by type
  warm-up.tsx
  intro.tsx
  card.tsx
  tap-to-complete.tsx
  tap-to-order.tsx
  listen-match.tsx
  listen-repeat.tsx
  watch-reflect.tsx
  complete-chat.tsx
  write-complete.tsx
  listen-complete.tsx
```

`ExerciseRenderer` is the single entry point that takes an `Exercise` and renders the appropriate interactive component.

## API Changes

### Updated Endpoints

**POST /api/v1/exercises** — Generation
- Body changes: `exercises: [{type, count}]` (no more `templateId` or `proposedTemplate`)
- Backend maps type → hardcoded prompt
- Embedding dedup before generation

**PUT /api/v1/exercises/[id]** — Regeneration
- Already accepts `customPrompt` (just implemented)
- Remove template-based generation path; use hardcoded prompt for the exercise's type
- Keep in-place update (preserves ID + lesson links)

**POST /api/v1/exercises/analyze** — Analysis
- Returns suggestions using 11 fixed types
- No more `proposedTemplates` in response

**GET /api/v1/exercises** — List
- No changes (type field values just change)

**PATCH /api/v1/exercises/[id]** — Edit
- Add `title`, `videoUrl`, `imageUrl` to editable fields

**DELETE endpoints** — Remove template endpoints entirely

### New Response Shape

Exercise objects in all responses include new fields:
```json
{
  "id": "...",
  "type": "tap_to_complete",
  "title": "Complete the sentence",
  "targetSkill": "grammar",
  "topic": "Present Simple",
  "language": "en",
  "instruction": "Tap the correct option",
  "content": "She ___ to school",
  "options": ["goes", "go", "going"],
  "correctAnswer": "goes",
  "explanation": "Third person singular...",
  "cefrLevel": "A2",
  "audioUrl": null,
  "videoUrl": null,
  "imageUrl": null,
  "source": "ai_live",
  "createdAt": "..."
}
```

## Migration

Clean slate approach — no data migration needed:

1. Drop all rows from `exercise`, `lesson_exercise`, `report_exercise`, `exercise_template` tables
2. Drop `templateId` column from `exercise`
3. Add `title`, `videoUrl`, `imageUrl` columns to `exercise`
4. Update `ExerciseType` enum in shared types
5. Remove `ExerciseTemplate` entity from entities file
6. Remove template-related code (endpoints, wizard sections, API calls)

## Files to Modify

### Shared Types
- `packages/shared/src/types/index.ts` — Replace ExerciseType enum (11 types), remove TargetSkill if needed

### Entities
- `apps/web/src/entities/index.ts` — Remove ExerciseTemplate entity, remove templateId from Exercise, add title/videoUrl/imageUrl

### AI Pipeline
- `packages/ai-pipeline/src/index.ts` — New `generateExercisesByType()` function with hardcoded prompts per type, remove `generateExercisesFromTemplates()`

### API Routes
- `apps/web/src/app/api/v1/exercises/route.ts` — Update POST to use type-based generation
- `apps/web/src/app/api/v1/exercises/[id]/route.ts` — Update PUT to use type-based regeneration, add new fields to PATCH
- `apps/web/src/app/api/v1/exercises/analyze/route.ts` — Return fixed types instead of templates
- Delete `apps/web/src/app/api/v1/exercises/templates/` directory

### Components
- `apps/web/src/components/exercise-wizard.tsx` — Simplify Step 2 (fixed types, no proposals, no browse), enhance Step 3 preview
- `apps/web/src/components/exercises/` — New directory with 11 interactive components + renderer
- `apps/web/src/app/(dashboard)/dashboard/exercises/page.tsx` — Use ExerciseRenderer for preview, remove template management UI
- `apps/web/src/app/(dashboard)/dashboard/lessons/[id]/page.tsx` — Use ExerciseRenderer for preview

### Database
- New migration: drop templates, alter exercise table

## Implementation Order

1. **Data model**: Update enum, entity, add fields, remove template
2. **Migration**: Clean slate DB migration
3. **AI pipeline**: Hardcoded prompts per type, new generation function
4. **API routes**: Update POST/PUT/PATCH/analyze, delete template endpoints
5. **Exercise components**: Build 11 interactive preview components + renderer
6. **Wizard**: Simplify to use fixed types
7. **Dashboard pages**: Wire ExerciseRenderer into exercise bank + lesson detail
8. **Cleanup**: Remove all template-related code
