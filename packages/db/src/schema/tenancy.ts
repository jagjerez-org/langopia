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
import { authUsers } from "./auth.js";
import { membershipRole, membershipStatus, merchantStatus, schoolStatus } from "./enums.js";

/**
 * Usuarios: la única tabla GLOBAL con datos de personas.
 *
 * Una misma persona puede dar clase en dos escuelas. Por eso la identidad vive
 * fuera del tenant y el vínculo con la escuela lo hace `memberships`. Esta tabla
 * NO lleva `school_id` y NO tiene política RLS por escuela.
 *
 * `authUserId` es el puente con la credencial de Better Auth (`user.id`), y es
 * lo que decide en qué escuelas entra quien inicia sesión. Antes ese puente era
 * el correo, unido con `lower(email)` dentro de `memberships_for_email`, y eso
 * convertía `users.email` en una llave: cambiarlo al de un dueño ya registrado
 * era apropiarse de su escuela. Se tapaba con un disparador que hacía el correo
 * inmutable —que además rompía cualquier pantalla de edición de perfil con un
 * `check_violation` de Postgres—. Con esta columna el vínculo es un
 * identificador opaco que la persona no elige ni puede cambiar, y el correo
 * vuelve a ser un dato editable.
 *
 * Es NULL mientras nadie haya registrado credencial para esa persona: un
 * usuario del dominio dado de alta por su escuela existe antes de tener con qué
 * entrar. NULL significa exactamente eso —sin membresías que resolver—, y en
 * Postgres varios NULL no chocan con el índice único.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Credencial de Better Auth asociada. `set null` al borrarla: la persona y
     * su historial siguen existiendo aunque su forma de entrar desaparezca.
     */
    authUserId: text("auth_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: text("name").notNull(),
    /** Idioma de la interfaz para esta persona. Independiente del de la escuela. */
    locale: text("locale").notNull().default("es-ES"),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    avatarUrl: text("avatar_url"),
    /** Proveedor OAuth con el que entró por primera vez: google, microsoft, password. */
    authProvider: text("auth_provider").notNull().default("password"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    // Una credencial de Better Auth no puede apuntar a dos personas del
    // dominio: si pudiera, resolver el tenant volvería a ser ambiguo.
    uniqueIndex("users_auth_user_id_uq").on(t.authUserId),
  ],
);

/**
 * Escuela = tenant. Raíz de todo lo demás.
 */
export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Subdominio: `atlantico` → atlantico.langopia.app */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    country: text("country").notNull().default("ES"),

    /* — Multiidioma —
     * `defaultLocale` decide en qué idioma se emiten facturas y correos cuando
     * el destinatario no tiene preferencia. `supportedLocales` limita qué
     * idiomas puede elegir un miembro de esta escuela.
     */
    defaultLocale: text("default_locale").notNull().default("es-ES"),
    supportedLocales: text("supported_locales")
      .array()
      .notNull()
      .default(sql`ARRAY['es-ES']::text[]`),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    currency: text("currency").notNull().default("EUR"),

    status: schoolStatus("status").notNull().default("trial"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),

    /* — Tu cobro a la escuela — */
    billingCustomerRef: text("billing_customer_ref"),

    /* — El cobro de la escuela a sus alumnos, vía su propio proveedor de pago — */
    merchantStatus: merchantStatus("merchant_status").notNull().default("not_started"),
    merchantRef: text("merchant_ref"),
    merchantOnboardedAt: timestamp("merchant_onboarded_at", { withTimezone: true }),

    /* — Comisión de plataforma, configurable —
     * En puntos básicos: 250 = 2,50 %. Se aplica solo a las facturas
     * `school_to_student` y solo si `applicationFeeEnabled` es cierto.
     * Se guarda además en cada pago para no perder el histórico si cambia.
     */
    applicationFeeEnabled: boolean("application_fee_enabled").notNull().default(false),
    applicationFeeBps: integer("application_fee_bps").notNull().default(0),
    /** Tope por operación, en céntimos. NULL = sin tope. */
    applicationFeeCapCents: integer("application_fee_cap_cents"),

    /* — Créditos de IA — */
    aiCreditsBalance: integer("ai_credits_balance").notNull().default(0),
    /** Corta la generación cuando el saldo llega a cero. */
    aiHardLimit: boolean("ai_hard_limit").notNull().default(true),
    /** El módulo de vídeo está en beta: apagado salvo que se active a propósito. */
    videoBetaEnabled: boolean("video_beta_enabled").notNull().default(false),

    branding: jsonb("branding")
      .$type<{ logoUrl?: string; primaryColor?: string; accentColor?: string }>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    /** Días que se conservan grabaciones y transcripciones. RGPD. */
    dataRetentionDays: integer("data_retention_days").notNull().default(180),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("schools_slug_uq").on(t.slug),
    index("schools_status_ix").on(t.status),
  ],
);

/**
 * Dominios propios de la escuela, para el constructor de webs (ola 4).
 */
export const schoolDomains = pgTable(
  "school_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("pending"),
    verificationToken: text("verification_token").notNull().default("legacy-verified-domain"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '48 hours'`),
    verificationFailedAt: timestamp("verification_failed_at", { withTimezone: true }),
    verificationFailureReason: text("verification_failure_reason"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    tlsIssuedAt: timestamp("tls_issued_at", { withTimezone: true }),
    tlsStatus: text("tls_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("school_domains_hostname_uq").on(t.hostname),
    index("school_domains_school_ix").on(t.schoolId),
  ],
);

/**
 * Vínculo persona ↔ escuela ↔ rol. Es la tabla que hace posible el multi-tenant
 * sin duplicar personas: el mismo `userId` puede tener varias filas.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    status: membershipStatus("status").notNull().default("active"),
    /** Idioma preferido dentro de ESTA escuela. NULL → hereda el del usuario. */
    locale: text("locale"),
    invitedByMembershipId: uuid("invited_by_membership_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("memberships_school_user_role_uq").on(t.schoolId, t.userId, t.role),
    index("memberships_school_ix").on(t.schoolId),
    index("memberships_user_ix").on(t.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: membershipRole("role").notNull(),
    token: text("token").notNull(),
    locale: text("locale"),
    invitedByMembershipId: uuid("invited_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitations_token_uq").on(t.token),
    index("invitations_school_ix").on(t.schoolId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  memberships: many(memberships),
  domains: many(schoolDomains),
  invitations: many(invitations),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  school: one(schools, { fields: [memberships.schoolId], references: [schools.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));
