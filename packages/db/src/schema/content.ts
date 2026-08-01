import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  assetKind,
  cefrLevel,
  contentSource,
  contentStatus,
  exerciseType,
  languageSkill,
  materialFormat,
} from "./enums.js";
import { courses } from "./catalog.js";
import { studentProfiles } from "./people.js";
import { memberships, schools } from "./tenancy.js";
import { vector } from "./vector-type.js";

/**
 * Dimensión de los embeddings de `content_material_chunks` (tarea 14 de la
 * ola 2). 1024 es la salida de `voyage-3` — el proveedor de embeddings que
 * recomienda Anthropic al no ofrecer uno propio—, pero es un valor
 * provisional: cambiar de proveedor real puede exigir otra dimensión, y
 * entonces esta constante (y una migración) son lo único que cambia. Debe
 * coincidir con `MATERIAL_EMBEDDING_DIMENSIONS` en
 * `apps/api/src/contexts/learning/infrastructure/external/embedding.adapter.ts`
 * — un desajuste falla alto y claro (error de Postgres al insertar), nunca
 * en silencio.
 */
export const MATERIAL_EMBEDDING_DIMENSIONS = 1024;

/**
 * Unidad didáctica. Es la pieza que genera la IA y que el profesor revisa
 * antes de publicar: `in_review` → `published` es la frontera donde una
 * persona se hace responsable de lo que ve el alumno.
 */
export const contentUnits = pgTable(
  "content_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),

    code: text("code").notNull(),
    language: text("language").notNull(),
    level: cefrLevel("level").notNull(),
    /** Destrezas que trabaja la unidad. */
    skills: languageSkill("skills")
      .array()
      .notNull()
      .default(sql`ARRAY[]::language_skill[]`),
    topic: text("topic").notNull(),

    source: contentSource("source").notNull().default("ai_generated"),
    status: contentStatus("status").notNull().default("draft"),
    /** Idioma en el que se generó primero. Los demás son traducciones. */
    primaryLocale: text("primary_locale").notNull(),

    /* — Coste real de generarla. Sin esto no se puede facturar por créditos. — */
    generationCostCents: integer("generation_cost_cents").notNull().default(0),
    creditsSpent: integer("credits_spent").notNull().default(0),

    createdByMembershipId: uuid("created_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_units_school_code_uq").on(t.schoolId, t.code),
    index("content_units_school_ix").on(t.schoolId),
    index("content_units_school_status_ix").on(t.schoolId, t.status),
    index("content_units_level_ix").on(t.schoolId, t.language, t.level),
  ],
);

export const contentUnitTranslations = pgTable(
  "content_unit_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    contentUnitId: uuid("content_unit_id")
      .notNull()
      .references(() => contentUnits.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    body: text("body"),
    /** Cierto si esta traducción la hizo la IA y nadie la ha revisado aún. */
    machineTranslated: boolean("machine_translated").notNull().default(false),
  },
  (t) => [
    uniqueIndex("content_unit_translations_unit_locale_uq").on(t.contentUnitId, t.locale),
    index("content_unit_translations_school_ix").on(t.schoolId),
  ],
);

/** Audio, imagen, vídeo o documento asociado a una unidad. */
export const contentAssets = pgTable(
  "content_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    contentUnitId: uuid("content_unit_id")
      .notNull()
      .references(() => contentUnits.id, { onDelete: "cascade" }),
    kind: assetKind("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    durationMs: integer("duration_ms"),
    /** Proveedor que lo generó, o `upload` si lo subió la escuela. */
    provider: text("provider").notNull().default("upload"),
    /** Los vídeos generados van marcados: el módulo está en beta. */
    isBeta: boolean("is_beta").notNull().default(false),
    /** Texto alternativo por idioma: { "es-ES": "...", "en-GB": "..." } */
    altText: jsonb("alt_text")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_assets_unit_ix").on(t.contentUnitId),
    index("content_assets_school_ix").on(t.schoolId),
  ],
);

/** Rúbrica de corrección. Los criterios siguen los descriptores del MCER. */
export const rubrics = pgTable(
  "rubrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    maxScore: smallint("max_score").notNull().default(20),
    criteria: jsonb("criteria")
      .$type<Array<{ key: string; label: string; weight: number; descriptors: string[] }>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rubrics_school_code_uq").on(t.schoolId, t.code)],
);

/**
 * Ejercicio. `prompt` y `solution` son JSON porque su forma depende del tipo:
 * un cloze lleva huecos, un par mínimo lleva dos audios, una producción
 * escrita lleva enunciado y rúbrica.
 */
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    contentUnitId: uuid("content_unit_id")
      .notNull()
      .references(() => contentUnits.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    type: exerciseType("type").notNull(),
    skill: languageSkill("skill").notNull(),
    level: cefrLevel("level").notNull(),

    prompt: jsonb("prompt").$type<Record<string, unknown>>().notNull(),
    solution: jsonb("solution").$type<Record<string, unknown>>(),
    rubricId: uuid("rubric_id").references(() => rubrics.id, { onDelete: "set null" }),

    maxScore: smallint("max_score").notNull().default(1),
    maxAttempts: smallint("max_attempts").notNull().default(3),
    /** Si sus ítems entran en el repaso espaciado del alumno. */
    srsEnabled: boolean("srs_enabled").notNull().default(false),
    /** Requiere que una persona valide la nota antes de que cuente. */
    requiresTeacherValidation: boolean("requires_teacher_validation").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("exercises_unit_position_uq").on(t.contentUnitId, t.position),
    index("exercises_school_ix").on(t.schoolId),
    index("exercises_type_ix").on(t.schoolId, t.type),
  ],
);

export const exerciseTranslations = pgTable(
  "exercise_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    /** Solo se traducen las instrucciones, nunca el contenido en el idioma meta. */
    instructions: text("instructions").notNull(),
    machineTranslated: boolean("machine_translated").notNull().default(false),
  },
  (t) => [
    uniqueIndex("exercise_translations_exercise_locale_uq").on(t.exerciseId, t.locale),
    index("exercise_translations_school_ix").on(t.schoolId),
  ],
);

/**
 * Tarjeta de repetición espaciada. Un ítem por alumno y ejercicio, con los
 * parámetros del algoritmo (ease, intervalo, repeticiones, fallos).
 */
export const srsCards = pgTable(
  "srs_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("exercise"),
    sourceTranscriptId: uuid("source_transcript_id"),
    term: text("term"),
    definition: text("definition"),
    level: cefrLevel("level"),
    ease: real("ease").notNull().default(2.5),
    intervalDays: smallint("interval_days").notNull().default(1),
    repetitions: smallint("repetitions").notNull().default(0),
    lapses: smallint("lapses").notNull().default(0),
    dueOn: date("due_on").notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("srs_cards_student_exercise_uq").on(t.studentProfileId, t.exerciseId),
    uniqueIndex("srs_cards_student_transcript_term_uq").on(
      t.studentProfileId,
      t.sourceTranscriptId,
      sql`lower(${t.term})`,
    ),
    index("srs_cards_school_due_ix").on(t.schoolId, t.dueOn),
  ],
);

/**
 * Material propio subido por la escuela (tarea 14 de la ola 2): el cuaderno
 * de siempre, sus audios, sus PDF. El fichero original nunca se toca — se
 * guarda tal cual en `original_storage_key` para que la escuela lo pueda
 * descargar siempre— y `processed_storage_key` es una versión aparte
 * (el texto extraído de un PDF/DOCX, guardado también como objeto), nunca un
 * reemplazo del original.
 *
 * `content_unit_id` es NULL hasta que el material se usa para crear una
 * unidad `hybrid` (`POST /learning/units/from-material`): subir un material
 * no crea todavía ninguna unidad ni gasta crédito.
 */
export const contentMaterials = pgTable(
  "content_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    contentUnitId: uuid("content_unit_id").references(() => contentUnits.id, { onDelete: "set null" }),

    format: materialFormat("format").notNull(),
    originalFilename: text("original_filename").notNull(),
    originalStorageKey: text("original_storage_key").notNull(),
    originalMimeType: text("original_mime_type").notNull(),
    originalBytes: integer("original_bytes").notNull(),

    /** Solo PDF/DOCX: el texto extraído, guardado también como objeto aparte del original. */
    processedStorageKey: text("processed_storage_key"),
    processedMimeType: text("processed_mime_type"),
    extractedText: text("extracted_text"),
    /** NULL mientras no se ha troceado ni generado ningún embedding todavía. */
    indexedAt: timestamp("indexed_at", { withTimezone: true }),

    uploadedByMembershipId: uuid("uploaded_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_materials_school_ix").on(t.schoolId),
    index("content_materials_unit_ix").on(t.contentUnitId),
  ],
);

/**
 * Fragmento indexado de un material, con su embedding (`pgvector`). Es lo
 * que permite generar ejercicios a partir del material propio de la escuela
 * sin mandar el documento entero al modelo: se recuperan solo los
 * fragmentos semánticamente cercanos al tema pedido.
 */
export const contentMaterialChunks = pgTable(
  "content_material_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => contentMaterials.id, { onDelete: "cascade" }),
    chunkIndex: smallint("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: MATERIAL_EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_material_chunks_material_index_uq").on(t.materialId, t.chunkIndex),
    index("content_material_chunks_school_ix").on(t.schoolId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const contentUnitsRelations = relations(contentUnits, ({ one, many }) => ({
  school: one(schools, { fields: [contentUnits.schoolId], references: [schools.id] }),
  course: one(courses, { fields: [contentUnits.courseId], references: [courses.id] }),
  translations: many(contentUnitTranslations),
  assets: many(contentAssets),
  exercises: many(exercises),
  materials: many(contentMaterials),
}));

export const contentMaterialsRelations = relations(contentMaterials, ({ one, many }) => ({
  school: one(schools, { fields: [contentMaterials.schoolId], references: [schools.id] }),
  unit: one(contentUnits, { fields: [contentMaterials.contentUnitId], references: [contentUnits.id] }),
  chunks: many(contentMaterialChunks),
}));

export const contentMaterialChunksRelations = relations(contentMaterialChunks, ({ one }) => ({
  material: one(contentMaterials, {
    fields: [contentMaterialChunks.materialId],
    references: [contentMaterials.id],
  }),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  unit: one(contentUnits, { fields: [exercises.contentUnitId], references: [contentUnits.id] }),
  rubric: one(rubrics, { fields: [exercises.rubricId], references: [rubrics.id] }),
  translations: many(exerciseTranslations),
}));
