import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { attendanceSource, attendanceStatus, roomProvider, sessionStatus } from "./enums.js";
import { groups } from "./catalog.js";
import { studentProfiles, teacherProfiles } from "./people.js";
import { memberships, schools } from "./tenancy.js";

/**
 * Serie recurrente. Las sesiones se materializan como filas reales en
 * `sessions` en vez de calcularse al vuelo: solo así se puede cancelar o
 * replanificar una instancia suelta sin romper la serie.
 */
export const sessionRecurrences = pgTable(
  "session_recurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** RRULE de iCalendar. Ej.: FREQ=WEEKLY;BYDAY=MO,WE;COUNT=24 */
    rrule: text("rrule").notNull(),
    timezone: text("timezone").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    until: timestamp("until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_recurrences_school_ix").on(t.schoolId)],
);

/** Una clase concreta. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    teacherProfileId: uuid("teacher_profile_id").references(() => teacherProfiles.id, {
      onDelete: "set null",
    }),
    recurrenceId: uuid("recurrence_id").references(() => sessionRecurrences.id, {
      onDelete: "set null",
    }),

    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),

    status: sessionStatus("status").notNull().default("scheduled"),
    topic: text("topic"),
    /** Unidad didáctica que se imparte. Se rellena desde la ola 2. */
    contentUnitId: uuid("content_unit_id"),

    /* — Aula — */
    roomProvider: roomProvider("room_provider").notNull().default("livekit"),
    roomUrl: text("room_url"),
    /** ID de la reunión en Zoom, Meet o Teams, para importar asistencia y transcripción. */
    roomExternalId: text("room_external_id"),

    /* — Cancelación y replanificación — */
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledByMembershipId: uuid("canceled_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    cancelReason: text("cancel_reason"),
    /** Horas de antelación con las que se avisó. */
    cancelNoticeHours: smallint("cancel_notice_hours"),
    /**
     * Si la cancelación genera derecho a devolución.
     *
     * Lo decide la política de cancelación de la escuela en el momento de
     * cancelar y queda congelado aquí: si mañana la escuela cambia su
     * política, las cancelaciones pasadas no cambian de criterio. Facturación
     * lo lee para abrir la nota de abono sin volver a razonar sobre horas.
     */
    cancelRefundDue: boolean("cancel_refund_due"),
    /** Si esta sesión sustituye a otra que se replanificó. */
    rescheduledFromSessionId: uuid("rescheduled_from_session_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_school_ix").on(t.schoolId),
    index("sessions_school_start_ix").on(t.schoolId, t.scheduledStart),
    index("sessions_group_ix").on(t.groupId),
    index("sessions_teacher_start_ix").on(t.teacherProfileId, t.scheduledStart),
    index("sessions_status_ix").on(t.schoolId, t.status),
  ],
);

/**
 * Asistencia por alumno y clase.
 *
 * `source` distingue lo detectado por el aula propia de lo marcado a mano y de
 * lo importado del informe de Zoom o Teams. Importa para la analítica: la
 * asistencia manual es mucho menos fiable.
 */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull(),
    source: attendanceSource("source").notNull().default("manual"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    minutesPresent: integer("minutes_present"),
    note: text("note"),
    recordedByMembershipId: uuid("recorded_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_session_student_uq").on(t.sessionId, t.studentProfileId),
    index("attendance_school_ix").on(t.schoolId),
    index("attendance_student_ix").on(t.studentProfileId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  school: one(schools, { fields: [sessions.schoolId], references: [schools.id] }),
  group: one(groups, { fields: [sessions.groupId], references: [groups.id] }),
  teacher: one(teacherProfiles, {
    fields: [sessions.teacherProfileId],
    references: [teacherProfiles.id],
  }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  session: one(sessions, { fields: [attendance.sessionId], references: [sessions.id] }),
  student: one(studentProfiles, {
    fields: [attendance.studentProfileId],
    references: [studentProfiles.id],
  }),
}));
