import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { transcriptStatus } from "./enums.js";
import { sessions } from "./scheduling.js";
import { memberships, schools } from "./tenancy.js";

/**
 * Transcripción de una clase.
 *
 * El estado `blocked_no_consent` es el caso importante: si alguien de la clase
 * —o el tutor de un menor— no ha consentido, no se transcribe nada y queda
 * registrado por qué. `retentionUntil` lo calcula la escuela con su política
 * de conservación; un trabajo periódico borra lo vencido.
 */
export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),

    status: transcriptStatus("status").notNull().default("pending"),
    /** `livekit` en el aula propia; `zoom`, `google_meet` o `ms_teams` si se importó. */
    provider: text("provider").notNull().default("livekit"),
    language: text("language").notNull(),
    durationMs: integer("duration_ms"),

    summary: text("summary"),
    /** Vocabulario detectado, para alimentar el repaso espaciado. */
    vocabulary: jsonb("vocabulary")
      .$type<Array<{ term: string; lemma?: string; level?: string; count: number }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Motivo por el que no se pudo o no se debió transcribir. */
    blockedReason: text("blocked_reason"),
    /** Grabación de audio o vídeo asociada, si la escuela la conserva. */
    recordingStorageKey: text("recording_storage_key"),
    recordingDeletedAt: timestamp("recording_deleted_at", { withTimezone: true }),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("transcripts_session_uq").on(t.sessionId),
    index("transcripts_school_ix").on(t.schoolId),
    index("transcripts_school_status_ix").on(t.schoolId, t.status),
    index("transcripts_retention_ix").on(t.retentionUntil),
  ],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    transcriptId: uuid("transcript_id")
      .notNull()
      .references(() => transcripts.id, { onDelete: "cascade" }),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    /** NULL si no se pudo identificar a quién corresponde la voz. */
    speakerMembershipId: uuid("speaker_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    speakerLabel: text("speaker_label"),
    text: text("text").notNull(),
    /** Confianza del reconocimiento, de 0 a 1. */
    confidence: integer("confidence_bps"),
    isTeacher: boolean("is_teacher").notNull().default(false),
  },
  (t) => [
    index("transcript_segments_transcript_ix").on(t.transcriptId, t.startMs),
    index("transcript_segments_school_ix").on(t.schoolId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  session: one(sessions, { fields: [transcripts.sessionId], references: [sessions.id] }),
  segments: many(transcriptSegments),
}));

export const transcriptSegmentsRelations = relations(transcriptSegments, ({ one }) => ({
  transcript: one(transcripts, {
    fields: [transcriptSegments.transcriptId],
    references: [transcripts.id],
  }),
}));
