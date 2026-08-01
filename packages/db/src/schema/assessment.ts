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
  uuid,
} from "drizzle-orm/pg-core";
import { assessmentKind, assessmentStatus, attemptStatus, cefrLevel } from "./enums.js";
import { courses } from "./catalog.js";
import { contentUnits, exercises } from "./content.js";
import { studentProfiles, teacherProfiles } from "./people.js";
import { memberships, schools } from "./tenancy.js";
import { sessions } from "./scheduling.js";

/**
 * Un ítem del examen, ya generado (variante del contenido de las unidades de
 * origen, nunca un ejercicio de práctica reutilizado literal). `response` y
 * `result` empiezan `null` y se rellenan con `submit()`/`grade()`
 * respectivamente — este único JSON es el «papel» completo del examen a lo
 * largo de todo su ciclo de vida (Tarea 15 de la ola 2).
 */
export interface ExamItemRow {
  id: string;
  /** Ejercicio real de práctica del que es variante, si lo hay — trazabilidad para «no repetir literalmente». */
  sourceExerciseId: string | null;
  sourceContentUnitId: string;
  type: string;
  skill: string;
  level: string;
  prompt: Record<string, unknown>;
  /** `null` en los tipos que se corrigen con rúbrica. */
  solution: Record<string, unknown> | null;
  rubricId: string | null;
  rubricCode: string | null;
  maxScore: number;
  response: Record<string, unknown> | null;
  result: { score: number; feedback: string; model: string | null; costCents: number } | null;
}

export interface ExamSectionRow {
  skill: string;
  durationMinutes: number;
  items: ExamItemRow[];
}

/**
 * Examen o prueba de nivelación.
 *
 * `levelBefore` / `levelResult` permiten medir el avance real del alumno en la
 * escala MCER, que es el argumento de venta frente a un informe de asistencia.
 *
 * Las columnas `sourceContentUnitIds`, `skillDistribution`, `sections`,
 * `durationMinutes`, `mockFramework`, `aiScore`, `aiFeedback`, `aiModel` y
 * `aiCostCents` son de la Tarea 15 (generación de exámenes): la tabla ya
 * preveía `kind` (`unit_exam`/`level_exam`/`mock_official`) y la máquina de
 * estados (`assessment_status`) desde antes de que existiera código que las
 * usara; a estas se añade el «papel» del examen y su desglose IA/profesor,
 * con el mismo patrón que `attempts` (`aiScore`/`teacherScore` — aquí
 * `score` hace de nota final, sobrescrita por `validate()`, y `aiScore`
 * conserva la propuesta original para auditoría).
 *
 * Un `Exam` (Tarea 15) reutiliza `levelBefore` para el nivel MCER que
 * examina y `levelResult` para el nivel que PROPONE si se aprueba un
 * `level_exam` — ninguna columna nueva para eso: es exactamente lo que ya
 * documenta el párrafo de arriba, «medir el avance real del alumno».
 */
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    kind: assessmentKind("kind").notNull(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    contentUnitId: uuid("content_unit_id").references(() => contentUnits.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    language: text("language").notNull(),
    levelBefore: cefrLevel("level_before"),
    levelResult: cefrLevel("level_result"),
    score: real("score"),
    maxScore: real("max_score"),
    /** Desglose por destreza: { "listening": 0.8, "writing": 0.55, ... } */
    skillBreakdown: jsonb("skill_breakdown").$type<Record<string, number>>(),

    status: assessmentStatus("status").notNull().default("scheduled"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    validatedByMembershipId: uuid("validated_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),

    /** Unidades ya publicadas de las que se examina (plural: «unas unidades concretas»). */
    sourceContentUnitIds: uuid("source_content_unit_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    /** Reparto de destrezas pedido, en porcentaje (suma 100): { "reading": 25, "speaking": 25, ... } */
    skillDistribution: jsonb("skill_distribution").$type<Record<string, number>>(),
    /** El examen completo: secciones con sus ítems, respuesta y resultado (ver `ExamSectionRow`). */
    sections: jsonb("sections").$type<ExamSectionRow[]>(),
    /** Duración total asignada, en minutos. */
    durationMinutes: smallint("duration_minutes"),
    /** DELE / Cambridge / Goethe, solo si `kind = mock_official`: qué examen real simula. */
    mockFramework: text("mock_framework"),

    /** Propuesta de la IA (agregando la corrección automática y por rúbrica de cada ítem). */
    aiScore: real("ai_score"),
    aiFeedback: text("ai_feedback"),
    aiModel: text("ai_model"),
    aiCostCents: integer("ai_cost_cents").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assessments_school_ix").on(t.schoolId),
    index("assessments_student_ix").on(t.studentProfileId),
    index("assessments_school_kind_ix").on(t.schoolId, t.kind),
  ],
);

/**
 * Intento de un alumno sobre un ejercicio.
 *
 * La IA propone (`aiScore`, `aiFeedback`); el profesor firma
 * (`teacherScore`, `validatedByMembershipId`). Mientras el estado no sea
 * `teacher_validated`, la nota no cuenta para el expediente.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    /** Clase en la que se hizo, si fue en el aula. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    /** Examen del que forma parte, si lo hay. */
    assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "cascade" }),

    attemptNumber: smallint("attempt_number").notNull().default(1),
    response: jsonb("response").$type<Record<string, unknown>>().notNull(),

    status: attemptStatus("status").notNull().default("submitted"),
    aiScore: real("ai_score"),
    aiFeedback: text("ai_feedback"),
    /** Nota por criterio de la rúbrica: { "coherencia": 4, "lexico": 3, ... } */
    aiRubricScores: jsonb("ai_rubric_scores").$type<Record<string, number>>(),
    aiModel: text("ai_model"),
    aiCostCents: integer("ai_cost_cents").notNull().default(0),

    teacherScore: real("teacher_score"),
    teacherFeedback: text("teacher_feedback"),
    validatedByMembershipId: uuid("validated_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),

    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer("duration_ms"),
  },
  (t) => [
    index("attempts_school_ix").on(t.schoolId),
    index("attempts_student_ix").on(t.studentProfileId),
    index("attempts_exercise_ix").on(t.exerciseId),
    index("attempts_school_status_ix").on(t.schoolId, t.status),
  ],
);

/**
 * Valoración cualitativa del profesor sobre el avance de un alumno (módulo 11).
 *
 * `visibleToGuardian` importa con menores: la familia ve el informe, pero no
 * necesariamente todas las notas internas.
 */
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    teacherProfileId: uuid("teacher_profile_id")
      .notNull()
      .references(() => teacherProfiles.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),

    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    /** 1 = muy por debajo de lo esperado … 5 = muy por encima. */
    progressRating: smallint("progress_rating").notNull(),
    levelAtEvaluation: cefrLevel("level_at_evaluation"),
    strengths: text("strengths"),
    improvements: text("improvements"),
    nextSteps: text("next_steps"),

    visibleToStudent: boolean("visible_to_student").notNull().default(true),
    visibleToGuardian: boolean("visible_to_guardian").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evaluations_school_ix").on(t.schoolId),
    index("evaluations_student_ix").on(t.studentProfileId),
    index("evaluations_teacher_period_ix").on(t.teacherProfileId, t.periodEnd),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  student: one(studentProfiles, {
    fields: [assessments.studentProfileId],
    references: [studentProfiles.id],
  }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  exercise: one(exercises, { fields: [attempts.exerciseId], references: [exercises.id] }),
  student: one(studentProfiles, {
    fields: [attempts.studentProfileId],
    references: [studentProfiles.id],
  }),
  assessment: one(assessments, { fields: [attempts.assessmentId], references: [assessments.id] }),
}));

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  teacher: one(teacherProfiles, {
    fields: [evaluations.teacherProfileId],
    references: [teacherProfiles.id],
  }),
  student: one(studentProfiles, {
    fields: [evaluations.studentProfileId],
    references: [studentProfiles.id],
  }),
}));
