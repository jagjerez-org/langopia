# Exercise Generation Wizard Design

## Overview

Replace the current inline exercise generation forms with a 3-step wizard dialog. The wizard introduces an AI analysis step that suggests exercise types and counts based on uploaded material, and can propose new exercise templates.

## Wizard Structure

### Step 1: Material & Topic
- File upload dropzone (PDF, DOCX, TXT, images)
- Topic input (pre-filled from lesson title when in lesson context)
- Language + CEFR level selectors (pre-filled from lesson when available)
- "Analyze" button → calls `POST /api/v1/exercises/analyze`

### Step 2: Exercise Plan
- AI suggestions list: exercise type + recommended count (editable +/- controls)
- Proposed new template cards (if AI suggests new types): name, description, sample prompt — Accept/Reject per card
- "Browse existing exercises" collapsible section: search + filter existing exercises to reuse (checkbox select)
- "Generate" button → calls `POST /api/v1/exercises` with the selected plan

### Step 3: Review & Save
- Generated exercise cards with preview (instruction, content, type badge, skill badge)
- Checkbox per exercise to include/exclude
- Reused exercises listed separately (already saved, just need linking)
- "Save Selected" button → links exercises to lesson/class/path

## API Design

### POST /api/v1/exercises/analyze (NEW)

**Request** (multipart/form-data):
```
files?: File[]           // uploaded material
topic?: string           // manual topic override
language: string         // "en", "es", etc.
cefrLevel: string        // "A1"–"C2"
existingTypes: string[]  // exercise template slugs already in academy
```

**Response:**
```json
{
  "detectedTopic": "Business negotiations vocabulary",
  "suggestions": [
    {
      "type": "fill_in_blank",
      "templateId": "uuid",
      "count": 3,
      "reason": "Material contains key vocabulary terms"
    }
  ],
  "proposedTemplates": [
    {
      "name": "Debate Preparation",
      "slug": "debate_preparation",
      "description": "Exercises that prepare students for structured debates",
      "samplePrompt": "Generate {{count}} debate preparation exercises...",
      "suggestedCount": 2
    }
  ],
  "materialSummary": "A business English text covering negotiation strategies..."
}
```

### POST /api/v1/exercises (UPDATED)

**New request shape** (extends current):
```json
{
  "exercises": [
    {
      "type": "fill_in_blank",
      "templateId": "uuid",
      "count": 3
    },
    {
      "type": "debate_preparation",
      "proposedTemplate": {
        "name": "Debate Preparation",
        "slug": "debate_preparation",
        "description": "...",
        "samplePrompt": "..."
      },
      "count": 2
    }
  ],
  "topic": "Business negotiations",
  "language": "en",
  "cefrLevel": "B2",
  "materialContext": "summary from analyze step",
  "lessonId": "uuid (optional, for auto-linking)",
  "reuseExerciseIds": ["uuid1", "uuid2"]
}
```

The endpoint creates proposed templates as ExerciseTemplate entities before generation. Legacy `templates` array format still works for backward compatibility.

## UI Component Design

```
<ExerciseWizard>
  ├── StepIndicator (horizontal stepper: 1·Material → 2·Plan → 3·Review)
  ├── Step1_Material
  │   ├── File upload dropzone
  │   ├── Topic input
  │   ├── Language + CEFR level selectors
  │   └── "Analyze" button
  ├── Step2_Plan
  │   ├── AI suggestions list (editable counts)
  │   ├── Proposed template cards (Accept/Reject)
  │   ├── Browse existing exercises (collapsible)
  │   └── "Generate" button
  └── Step3_Review
      ├── Generated exercise cards (preview + checkbox)
      ├── Reused exercises listed separately
      └── "Save Selected" button
```

**Integration points:**
- Exercise Bank page — "Generate Exercises" button opens wizard. No lesson context.
- Lesson detail page — "Generate" button opens wizard with `lessonId` prop. Topic/language/level pre-filled.

The wizard is always a dialog (shadcn `Dialog`), max-width ~`max-w-3xl`.

## Files Changed

| # | File | Action |
|---|------|--------|
| 1 | `packages/ai-pipeline/src/index.ts` | MODIFY — add `analyzeExerciseMaterial` function |
| 2 | `apps/web/src/app/api/v1/exercises/analyze/route.ts` | NEW — AI analysis endpoint |
| 3 | `apps/web/src/app/api/v1/exercises/route.ts` | MODIFY — extend POST for new contract |
| 4 | `apps/web/src/components/exercise-wizard.tsx` | NEW — 3-step wizard component |
| 5 | `apps/web/src/app/(dashboard)/dashboard/exercises/page.tsx` | MODIFY — replace inline form with wizard trigger |
| 6 | `apps/web/src/app/(dashboard)/dashboard/lessons/[id]/page.tsx` | MODIFY — replace inline form with wizard trigger |

## Implementation Order

1. Add `analyzeExerciseMaterial` to ai-pipeline
2. Create `/api/v1/exercises/analyze` endpoint
3. Update `/api/v1/exercises` POST for new contract
4. Build `ExerciseWizard` component
5. Integrate into Exercise Bank page
6. Integrate into Lesson detail page
