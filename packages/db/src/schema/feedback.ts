import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { respondentKind, reviewSubject, surveyKind } from "./enums.js";
import { contentUnits } from "./content.js";
import { teacherProfiles } from "./people.js";
import { sessions } from "./scheduling.js";
import { memberships, schools } from "./tenancy.js";

/** Plantilla de encuesta. Una escuela puede tener varias activas a la vez. */
export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    kind: surveyKind("kind").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    audience: respondentKind("audience").notNull(),
    /** Se envía automáticamente tras cada clase. */
    autoSendAfterSession: boolean("auto_send_after_session").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("surveys_school_code_uq").on(t.schoolId, t.code)],
);

/**
 * Respuesta a una encuesta.
 *
 * En NPS, `score` va de 0 a 10 (detractor 0-6, pasivo 7-8, promotor 9-10).
 * En CSAT y post-clase, de 1 a 5. Guardar la escala en `surveys.kind` evita
 * mezclarlas al calcular.
 */
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    respondentMembershipId: uuid("respondent_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    respondentKind: respondentKind("respondent_kind").notNull(),
    /** Clase concreta a la que se refiere, en las encuestas post-clase. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    teacherProfileId: uuid("teacher_profile_id").references(() => teacherProfiles.id, {
      onDelete: "set null",
    }),
    score: smallint("score").notNull(),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("survey_responses_school_ix").on(t.schoolId),
    index("survey_responses_survey_ix").on(t.surveyId),
    index("survey_responses_teacher_ix").on(t.teacherProfileId),
    index("survey_responses_school_submitted_ix").on(t.schoolId, t.submittedAt),
    uniqueIndex("survey_responses_unique_period_uq").on(
      t.surveyId,
      t.respondentMembershipId,
      sql`COALESCE(${t.sessionId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

/**
 * Reseña abierta sobre el material, una clase o un profesor (módulo 2:
 * «reseñas de los alumnos acerca del material y las clases»).
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    authorMembershipId: uuid("author_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    subject: reviewSubject("subject").notNull(),
    contentUnitId: uuid("content_unit_id").references(() => contentUnits.id, {
      onDelete: "cascade",
    }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),
    teacherProfileId: uuid("teacher_profile_id").references(() => teacherProfiles.id, {
      onDelete: "cascade",
    }),
    /** 1 a 5. */
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    /** La dirección la ha leído y actuado. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByMembershipId: uuid("acknowledged_by_membership_id").references(
      () => memberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_school_ix").on(t.schoolId),
    index("reviews_teacher_ix").on(t.teacherProfileId),
    index("reviews_unit_ix").on(t.contentUnitId),
    index("reviews_school_rating_ix").on(t.schoolId, t.rating),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const surveysRelations = relations(surveys, ({ many }) => ({
  responses: many(surveyResponses),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  survey: one(surveys, { fields: [surveyResponses.surveyId], references: [surveys.id] }),
  teacher: one(teacherProfiles, {
    fields: [surveyResponses.teacherProfileId],
    references: [teacherProfiles.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  teacher: one(teacherProfiles, {
    fields: [reviews.teacherProfileId],
    references: [teacherProfiles.id],
  }),
  unit: one(contentUnits, { fields: [reviews.contentUnitId], references: [contentUnits.id] }),
}));
