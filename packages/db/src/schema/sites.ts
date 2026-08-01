import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cefrLevel } from "./enums.js";
import { courses } from "./catalog.js";
import { studentProfiles } from "./people.js";
import { memberships, schools } from "./tenancy.js";

/* ─── Enumeraciones ────────────────────────────────────────────────────── */

export const siteStatus = pgEnum("site_status", ["draft", "published", "unpublished"]);

/**
 * Catálogo CERRADO de bloques.
 *
 * Cerrado a propósito: un lienzo libre no se termina nunca; ocho secciones se
 * construyen en dos semanas y se ven bien siempre.
 */
export const blockType = pgEnum("block_type", [
  "hero",
  "courses",
  "teachers",
  "pricing",
  "testimonials",
  "faq",
  "contact",
  "text",
]);

export const leadStatus = pgEnum("lead_status", [
  "new",
  "placement_sent",
  "placement_done",
  "contacted",
  "converted",
  "cold",
  "discarded",
]);

/* ─── Sitio web de la escuela ──────────────────────────────────────────── */

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    status: siteStatus("status").notNull().default("draft"),
    /** Idioma en el que se creó primero; el resto son traducciones de página. */
    primaryLocale: text("primary_locale").notNull(),
    /** Tokens de marca del sitio. Heredan de la escuela y se pueden sobrescribir. */
    theme: jsonb("theme")
      .$type<{ primaryColor?: string; accentColor?: string; fontPair?: string }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sites_school_uq").on(t.schoolId),
    index("sites_status_ix").on(t.status),
  ],
);

export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Vacío para la portada. */
    slug: text("slug").notNull().default(""),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    metaDescription: text("meta_description"),
    isHome: boolean("is_home").notNull().default(false),
    position: smallint("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("site_pages_site_slug_locale_uq").on(t.siteId, t.slug, t.locale),
    index("site_pages_school_ix").on(t.schoolId),
  ],
);

export const siteBlocks = pgTable(
  "site_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => sitePages.id, { onDelete: "cascade" }),
    type: blockType("type").notNull(),
    position: smallint("position").notNull(),
    /** Contenido según el tipo. Su forma la valida el dominio, no la tabla. */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (t) => [
    uniqueIndex("site_blocks_page_position_uq").on(t.pageId, t.position),
    index("site_blocks_school_ix").on(t.schoolId),
  ],
);

/* ─── Candidatos ───────────────────────────────────────────────────────── */

/**
 * Candidato: alguien que pidió información y todavía no es alumno.
 *
 * Guarda de dónde vino para poder medir qué página convierte. Al capturarlo se
 * le manda la prueba de nivelación: es la conversión más alta del embudo,
 * porque alguien que acaba de pedir información sí hace una prueba de cinco
 * minutos.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    locale: text("locale").notNull().default("es-ES"),
    message: text("message"),

    interestedLanguage: text("interested_language"),
    declaredLevel: cefrLevel("declared_level"),
    /** Nivel que salió de la prueba, que suele no coincidir con el declarado. */
    placementLevel: cefrLevel("placement_level"),
    placementScore: integer("placement_score"),
    suggestedCourseId: uuid("suggested_course_id").references(() => courses.id, {
      onDelete: "set null",
    }),

    status: leadStatus("status").notNull().default("new"),
    /** De dónde vino: página, idioma y campaña. Sin esto no se sabe qué funciona. */
    sourcePage: text("source_page"),
    sourceCampaign: text("source_campaign"),
    referrer: text("referrer"),

    /** Alumno resultante, si se convirtió. */
    convertedStudentProfileId: uuid("converted_student_profile_id").references(
      () => studentProfiles.id,
      { onDelete: "set null" },
    ),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    assignedToMembershipId: uuid("assigned_to_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    discardedReason: text("discarded_reason"),
  },
  (t) => [
    index("leads_school_status_ix").on(t.schoolId, t.status),
    index("leads_school_created_ix").on(t.schoolId, t.createdAt),
  ],
);

/* ─── Banco de preguntas de nivelación ─────────────────────────────────── */

/**
 * Ítem del banco de nivelación.
 *
 * Separado de `exercises` porque tiene otra vida: no pertenece a una unidad
 * didáctica, se reutiliza entre escuelas del mismo idioma y lleva parámetros
 * de dificultad que el algoritmo adaptativo necesita.
 */
export const placementItems = pgTable(
  "placement_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    level: cefrLevel("level").notNull(),
    skill: text("skill").notNull(),
    /** 0 a 1: proporción de acierto observada. Calibra el algoritmo. */
    difficulty: integer("difficulty_bps").notNull().default(5000),
    prompt: jsonb("prompt").$type<Record<string, unknown>>().notNull(),
    solution: jsonb("solution").$type<Record<string, unknown>>().notNull(),
    timesUsed: integer("times_used").notNull().default(0),
    timesCorrect: integer("times_correct").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("placement_items_school_lang_level_ix").on(t.schoolId, t.language, t.level),
  ],
);

/* ─── Autorizaciones MCP ───────────────────────────────────────────────── */

/**
 * Token vivo de un cliente MCP.
 *
 * Se guarda aparte de `mcp_clients` porque un cliente puede tener varias
 * autorizaciones —una por persona que lo conectó— y cada una lleva SU
 * membresía y SUS ámbitos. Es lo que impide que conectar Claude una vez dé
 * acceso a toda la escuela.
 */
export const mcpAuthorizations = pgTable(
  "mcp_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    mcpClientId: uuid("mcp_client_id").notNull(),
    /** La membresía cuyos permisos hereda el token. */
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mcp_authorizations_school_ix").on(t.schoolId),
    index("mcp_authorizations_client_ix").on(t.mcpClientId),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const sitesRelations = relations(sites, ({ one, many }) => ({
  school: one(schools, { fields: [sites.schoolId], references: [schools.id] }),
  pages: many(sitePages),
}));

export const sitePagesRelations = relations(sitePages, ({ one, many }) => ({
  site: one(sites, { fields: [sitePages.siteId], references: [sites.id] }),
  blocks: many(siteBlocks),
}));

export const siteBlocksRelations = relations(siteBlocks, ({ one }) => ({
  page: one(sitePages, { fields: [siteBlocks.pageId], references: [sitePages.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  school: one(schools, { fields: [leads.schoolId], references: [schools.id] }),
  convertedStudent: one(studentProfiles, {
    fields: [leads.convertedStudentProfileId],
    references: [studentProfiles.id],
  }),
}));
