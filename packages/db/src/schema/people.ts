import { relations, sql } from "drizzle-orm";
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
  consentKind,
  consentStatus,
  guardianRelationship,
  studentStatus,
  teacherStatus,
  teacherTier,
} from "./enums.js";
import { memberships, schools } from "./tenancy.js";

/**
 * Ficha de alumno.
 *
 * `dateOfBirth` es obligatoria: sin ella no se puede saber si hace falta
 * consentimiento parental, y el producto acepta alumnos de cualquier edad.
 * La minoría de edad NO se guarda como columna calculada porque depende de la
 * fecha de hoy; se deriva en la aplicación con `isMinor()`. Lo que sí se
 * materializa es `guardianRequired`, que la aplicación revisa en cada
 * cumpleaños y que gobierna los permisos de grabación.
 */
export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),

    dateOfBirth: date("date_of_birth").notNull(),
    guardianRequired: boolean("guardian_required").notNull().default(false),

    nativeLanguage: text("native_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    currentLevel: cefrLevel("current_level"),
    targetLevel: cefrLevel("target_level"),
    goals: text("goals"),

    status: studentStatus("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    pausedUntil: date("paused_until"),
    leftAt: timestamp("left_at", { withTimezone: true }),
    leftReason: text("left_reason"),

    /** Contacto de facturación cuando no paga el propio alumno (menor, empresa). */
    billingContactMembershipId: uuid("billing_contact_membership_id").references(
      () => memberships.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("student_profiles_membership_uq").on(t.membershipId),
    index("student_profiles_school_ix").on(t.schoolId),
    index("student_profiles_school_status_ix").on(t.schoolId, t.status),
  ],
);

/**
 * Tutor legal de un alumno menor. El tutor es a su vez un `membership` con rol
 * `guardian`, para que pueda entrar al portal y ver el progreso.
 */
export const guardians = pgTable(
  "guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    relationship: guardianRelationship("relationship").notNull(),
    isBillingContact: boolean("is_billing_contact").notNull().default(true),
    /** Puede firmar consentimientos en nombre del menor. */
    canGiveConsent: boolean("can_give_consent").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("guardians_student_membership_uq").on(t.studentProfileId, t.membershipId),
    index("guardians_school_ix").on(t.schoolId),
  ],
);

/**
 * Registro de consentimientos. Es la tabla que consulta el módulo de grabación
 * antes de encender nada, y la que se enseña en una auditoría RGPD.
 *
 * Para un menor, `grantedByMembershipId` apunta al tutor, no al alumno.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** De quién son los datos. */
    subjectMembershipId: uuid("subject_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    kind: consentKind("kind").notNull(),
    status: consentStatus("status").notNull().default("pending"),
    /** Quién lo otorgó: el propio interesado o su tutor legal. */
    grantedByMembershipId: uuid("granted_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    /** Versión del texto legal aceptado, para poder demostrar qué firmó. */
    policyVersion: text("policy_version").notNull().default("1.0"),
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("consents_subject_kind_uq").on(t.subjectMembershipId, t.kind),
    index("consents_school_ix").on(t.schoolId),
    index("consents_school_kind_status_ix").on(t.schoolId, t.kind, t.status),
  ],
);

/**
 * Ficha de profesor. Las tarifas siguen los tramos reales del mercado
 * (italki y Preply, julio 2026): community 4-15, professional 15-40,
 * specialist 30-75 por hora.
 */
export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),

    tier: teacherTier("tier").notNull().default("professional"),
    bio: text("bio"),
    /** Idiomas que imparte, en código ISO. */
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    certifications: text("certifications")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    isNativeSpeaker: boolean("is_native_speaker").notNull().default(false),

    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** Horas semanales contratadas. Denominador de la ocupación del panel. */
    contractedHoursWeek: smallint("contracted_hours_week").notNull().default(20),

    status: teacherStatus("status").notNull().default("active"),
    hiredAt: date("hired_at").notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    leftReason: text("left_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teacher_profiles_membership_uq").on(t.membershipId),
    index("teacher_profiles_school_ix").on(t.schoolId),
    index("teacher_profiles_school_status_ix").on(t.schoolId, t.status),
  ],
);

/**
 * Disponibilidad semanal recurrente, en minutos desde medianoche y en la zona
 * horaria de la escuela. Guardar minutos en vez de `time` evita el infierno
 * del horario de verano al comparar franjas.
 */
export const teacherAvailability = pgTable(
  "teacher_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    teacherProfileId: uuid("teacher_profile_id")
      .notNull()
      .references(() => teacherProfiles.id, { onDelete: "cascade" }),
    /** 1 = lunes … 7 = domingo (ISO-8601). */
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teacher_availability_teacher_ix").on(t.teacherProfileId)],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const studentProfilesRelations = relations(studentProfiles, ({ one, many }) => ({
  school: one(schools, { fields: [studentProfiles.schoolId], references: [schools.id] }),
  membership: one(memberships, {
    fields: [studentProfiles.membershipId],
    references: [memberships.id],
  }),
  guardians: many(guardians),
}));

export const guardiansRelations = relations(guardians, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [guardians.studentProfileId],
    references: [studentProfiles.id],
  }),
  membership: one(memberships, { fields: [guardians.membershipId], references: [memberships.id] }),
}));

export const teacherProfilesRelations = relations(teacherProfiles, ({ one, many }) => ({
  school: one(schools, { fields: [teacherProfiles.schoolId], references: [schools.id] }),
  membership: one(memberships, {
    fields: [teacherProfiles.membershipId],
    references: [memberships.id],
  }),
  availability: many(teacherAvailability),
}));
