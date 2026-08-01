import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  cefrLevel,
  courseModality,
  enrollmentStatus,
  groupStatus,
} from "./enums.js";
import { studentProfiles, teacherProfiles } from "./people.js";
import { schools } from "./tenancy.js";

/**
 * Curso: el programa formativo que vende la escuela.
 *
 * Los valores por defecto siguen el estándar del sector (Lingoda, julio 2026):
 * clases de 60 minutos, grupos de 3 a 5 alumnos, ~100 sesiones por nivel MCER.
 */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    language: text("language").notNull(),
    level: cefrLevel("level").notNull(),
    modality: courseModality("modality").notNull().default("group"),

    totalSessions: integer("total_sessions").notNull().default(50),
    sessionMinutes: smallint("session_minutes").notNull().default(60),
    maxStudents: smallint("max_students").notNull().default(5),

    /** Precio de catálogo por alumno y curso completo. */
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("courses_school_code_uq").on(t.schoolId, t.code),
    index("courses_school_ix").on(t.schoolId),
    index("courses_school_language_level_ix").on(t.schoolId, t.language, t.level),
  ],
);

/** Nombre y descripción del curso en cada idioma que soporta la escuela. */
export const courseTranslations = pgTable(
  "course_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => [
    uniqueIndex("course_translations_course_locale_uq").on(t.courseId, t.locale),
    index("course_translations_school_ix").on(t.schoolId),
  ],
);

/**
 * Grupo: la instancia concreta de un curso que se imparte en unas fechas con
 * un profesor. Un curso privado tiene grupos de un solo alumno.
 */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    teacherProfileId: uuid("teacher_profile_id").references(() => teacherProfiles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    capacity: smallint("capacity").notNull().default(5),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    status: groupStatus("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("groups_school_ix").on(t.schoolId),
    index("groups_school_status_ix").on(t.schoolId, t.status),
    index("groups_teacher_ix").on(t.teacherProfileId),
  ],
);

/** Matrícula de un alumno en un grupo. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("active"),
    /** Precio realmente acordado. Puede diferir del de catálogo (beca, promoción). */
    agreedPriceCents: integer("agreed_price_cents"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    transferredToGroupId: uuid("transferred_to_group_id"),
  },
  (t) => [
    uniqueIndex("enrollments_group_student_uq").on(t.groupId, t.studentProfileId),
    index("enrollments_school_ix").on(t.schoolId),
    index("enrollments_student_ix").on(t.studentProfileId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const coursesRelations = relations(courses, ({ one, many }) => ({
  school: one(schools, { fields: [courses.schoolId], references: [schools.id] }),
  translations: many(courseTranslations),
  groups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  school: one(schools, { fields: [groups.schoolId], references: [schools.id] }),
  course: one(courses, { fields: [groups.courseId], references: [courses.id] }),
  teacher: one(teacherProfiles, {
    fields: [groups.teacherProfileId],
    references: [teacherProfiles.id],
  }),
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  group: one(groups, { fields: [enrollments.groupId], references: [groups.id] }),
  student: one(studentProfiles, {
    fields: [enrollments.studentProfileId],
    references: [studentProfiles.id],
  }),
}));
