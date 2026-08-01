/**
 * Formas que devuelve `UnitsController` (`apps/api/src/contexts/learning/
 * infrastructure/http/units.controller.ts`) y su modelo de lectura
 * (`learning-read-model.port.ts`).
 *
 * Se declaran aquí, no en `@langopia/contracts`: el contexto `learning` no ha
 * publicado todavía sus tipos en ese paquete (igual que hizo la Tarea 15 con
 * `features/exams/types.ts`). El día que los publique, este fichero se
 * convierte en un reexport y ninguna pantalla cambia.
 */

/** Espejo de `content_status` (`packages/db/src/schema/enums.ts`). */
export const CONTENT_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Espejo de `content_source`. */
export type ContentSource = "ai_generated" | "uploaded" | "hybrid";

/** Espejo de `exercise_type`, en el mismo orden que `ExerciseType` del dominio. */
export const EXERCISE_TYPES = [
  "cloze",
  "multiple_choice",
  "matching",
  "ordering",
  "minimal_pairs",
  "dictation",
  "shadowing",
  "listening_comprehension",
  "reading_comprehension",
  "written_production",
  "spoken_production",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Espejo de `language_skill`. */
export const LANGUAGE_SKILLS = [
  "listening",
  "reading",
  "speaking",
  "writing",
  "vocabulary",
  "grammar",
  "phonetics",
] as const;
export type LanguageSkill = (typeof LANGUAGE_SKILLS)[number];

/** Espejo de `cefr_level`. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export interface ContentUnitListItem {
  contentUnitId: string;
  code: string;
  language: string;
  level: string;
  topic: string;
  status: string;
  source: string;
  creditsSpent: number;
  createdAt: string;
  title: string | null;
}

export interface ContentUnitExerciseView {
  exerciseId: string;
  position: number;
  type: ExerciseType;
  skill: string | null;
  prompt: Record<string, unknown>;
  solution: Record<string, unknown> | null;
  maxScore: number;
  requiresTeacherValidation: boolean;
}

export interface ContentUnitAssetView {
  assetId: string;
  kind: "audio" | "image" | "video" | "document";
  storageKey: string;
  mimeType: string;
  durationMs: number | null;
  isBeta: boolean;
  betaNotice: string | null;
}

export interface ContentUnitDetail {
  contentUnitId: string;
  code: string;
  language: string;
  level: string;
  topic: string;
  skills: string[];
  status: string;
  source: string;
  primaryLocale: string;
  creditsSpent: number;
  generationCostCents: number;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  title: string;
  description: string;
  body: string;
  exercises: ContentUnitExerciseView[];
  assets?: ContentUnitAssetView[];
}

/**
 * `GET /learning/units/generation-estimate`.
 *
 * `wouldBeRejected` llega DECIDIDO por el servidor (la misma comparación que
 * hace `CreditBalance.spend()` con `ai_hard_limit`): el panel lo enseña, no
 * lo recalcula comparando `estimatedCredits` con `currentBalance` — si lo
 * hiciera, habría dos verdades sobre cuándo se puede generar.
 */
export interface GenerationEstimate {
  estimatedCredits: number;
  currentBalance: number;
  hardLimit: boolean;
  wouldBeRejected: boolean;
  /** Tipos que la API rechaza hoy (los de audio, sin proveedor conectado). El panel los pinta, no los decide. */
  unavailableExerciseTypes: string[];
}

export interface GenerateUnitInput {
  code: string;
  language: string;
  level: string;
  topic: string;
  skills: string[];
  primaryLocale: string;
  exerciseTypes: string[];
  sourceMaterial?: string;
}

export interface GenerateUnitResult {
  contentUnitId: string;
  status: string;
}

export interface UpdateExerciseResult {
  exerciseId: string;
}

export interface PublishUnitResult {
  contentUnitId: string;
  status: string;
}

/**
 * `GET /learning/units/:id/publish-targets`: los grupos de la escuela a los
 * que se puede publicar esta unidad. QUÉ grupos son elegibles lo decide la
 * API (coincidencia de idioma y nivel del curso); el panel solo los lista.
 */
export interface PublishTarget {
  groupId: string;
  name: string;
  courseId: string;
  courseCode: string;
  level: string;
  language: string;
  status: string;
}
