import type { ExerciseType } from "../../domain/model/exercise-schemas.js";

/**
 * Modelo de lectura de `learning`, para la Tarea 11 del panel (generador de
 * contenido).
 *
 * Igual que `BillingReadModel`/`CatalogReadModel`/`SchedulingReadModel`: vive
 * en la capa de APLICACIÓN, no carga el agregado `ContentUnit` ni aplica
 * ninguna regla de negocio, y devuelve estructuras planas listas para
 * pintar. `POST /learning/units/generate` (tarea 6) solo devolvía
 * `{contentUnitId, status}` — nada con lo que construir una pantalla de
 * revisión — y `UnitsController` no tenía ningún `GET` todavía.
 */

export type ContentUnitListItem = {
  contentUnitId: string;
  code: string;
  language: string;
  level: string;
  topic: string;
  status: string;
  source: string;
  creditsSpent: number;
  createdAt: string;
  /** Título en `primaryLocale`, o `null` si la traducción aún no se guardó (no debería pasar tras generar). */
  title: string | null;
};

export type ContentUnitExerciseView = {
  exerciseId: string;
  position: number;
  type: ExerciseType;
  skill: string | null;
  prompt: Record<string, unknown>;
  solution: Record<string, unknown> | null;
  maxScore: number;
  requiresTeacherValidation: boolean;
};

export type ContentUnitAssetView = {
  assetId: string;
  kind: "audio" | "image" | "video" | "document";
  storageKey: string;
  mimeType: string;
  durationMs: number | null;
  isBeta: boolean;
  betaNotice: string | null;
};

export type ContentUnitDetail = {
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
  assets: ContentUnitAssetView[];
};

/**
 * Lo que hace falta para mostrar el coste ANTES de lanzar una generación
 * (Paso 1 del brief) y el aviso de saldo bajo/bloqueo (Paso 5), con el mismo
 * cuidado que la pantalla de facturación: ni un cálculo de negocio en el
 * cliente, `wouldBeRejected` ya viene decidido — la misma comparación que
 * hace `CreditBalance.spend()` con `ai_hard_limit`, no una repetida aquí.
 */
export type GenerationEstimate = {
  /** `ESTIMATED_CREDITS_RESERVE` (`generate-unit.handler.ts`): la reserva fija que hace cada generación, hoy sin variar por tipos ni cantidad de ejercicios. */
  estimatedCredits: number;
  currentBalance: number;
  hardLimit: boolean;
  wouldBeRejected: boolean;
  /**
   * Tipos de ejercicio que `GenerateUnitHandler` RECHAZA hoy, con el motivo
   * ya resuelto por el servidor: los tres que prometen un `audioRef` real,
   * mientras no haya proveedor de audio conectado a la generación (tarea 4
   * de la ola 2). Viaja en la estimación para que el formulario del panel
   * pueda deshabilitar esas casillas SIN llevar su propia copia de la lista
   * — que es exactamente la segunda verdad que `OLA-1-WEB.md` prohíbe: el
   * día que se conecte el proveedor, la lista se vacía aquí y el panel se
   * entera solo.
   */
  unavailableExerciseTypes: string[];
};

/**
 * Un grupo al que se puede publicar una unidad (Paso 4 del brief: «publicar a
 * grupos, con selector múltiple»).
 *
 * Sale de `learning` y no de `catalog` a propósito: `GET /courses` es de
 * `owner`/`admin`, y quien revisa y publica contenido puede ser `teacher`.
 * Además, lo que el selector necesita saber —de qué curso es cada grupo, y si
 * ese curso encaja con la unidad— es una pregunta sobre ESTA unidad, no un
 * listado de catálogo.
 *
 * `eligible` viene decidido por el servidor (mismo idioma y nivel que la
 * unidad): el panel lo muestra, nunca lo recalcula.
 */
export type PublishTarget = {
  groupId: string;
  name: string;
  courseId: string;
  courseCode: string;
  level: string;
  language: string;
  status: string;
  eligible: boolean;
};

export interface LearningReadModel {
  /** Unidades de la escuela activa, opcionalmente filtradas por estado. */
  listUnits(filter: { status?: string }): Promise<ContentUnitListItem[]>;

  /** Grupos de la escuela a los que se puede publicar esta unidad, con la elegibilidad ya decidida. */
  listPublishTargets(contentUnitId: string): Promise<PublishTarget[]>;

  /** Ficha completa de una unidad con sus ejercicios, o `null` si no existe (o RLS la oculta). */
  getUnitDetail(contentUnitId: string): Promise<ContentUnitDetail | null>;

  /** Saldo y coste estimado de generar una unidad, con el rechazo ya decidido. */
  getGenerationEstimate(): Promise<GenerationEstimate>;
}

export const LEARNING_READ_MODEL = Symbol("LearningReadModel");
