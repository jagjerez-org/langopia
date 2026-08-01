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
import { actorKind, aiGenerationKind, aiGenerationStatus } from "./enums.js";
import { contentUnits } from "./content.js";
import { memberships, schools, users } from "./tenancy.js";

/**
 * Registro de auditoría. Append-only.
 *
 * `actorKind` distingue lo que hizo una persona de lo que hizo un trabajo
 * automático o una llamada desde Claude o ChatGPT vía MCP. Sin esa distinción,
 * una auditoría RGPD no puede responder a «¿quién accedió a estos datos?».
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    actorKind: actorKind("actor_kind").notNull().default("user"),
    actorMembershipId: uuid("actor_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    /**
     * Quién era DE VERDAD, cuando `actorKind = 'impersonation'` (Tarea 17).
     * `actorMembershipId` sigue siendo quién PARECÍA —la membresía
     * impersonada—: esta columna no la sustituye, la acompaña. Ausente para
     * cualquier otra fila, y también cuando quien impersona es soporte de la
     * plataforma sin membresía en ninguna escuela — su identidad real consta
     * igualmente en `impersonations.impersonator_user_id`, el mismo criterio
     * de excepción que ya acepta `actorMembershipId` para `actorKind =
     * 'system'`.
     */
    impersonatorMembershipId: uuid("impersonator_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    /** Cliente MCP que originó la acción, si vino de ahí. */
    mcpClientId: uuid("mcp_client_id"),

    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_school_created_ix").on(t.schoolId, t.createdAt),
    index("audit_logs_entity_ix").on(t.entityType, t.entityId),
    index("audit_logs_actor_ix").on(t.actorMembershipId),
    index("audit_logs_impersonator_ix").on(t.impersonatorMembershipId),
  ],
);

/**
 * Personas con acceso de soporte de la plataforma (Tarea 17).
 *
 * Global, sin `school_id`: soporte no es un rol dentro de una escuela —puede
 * impersonar a un miembro de CUALQUIERA (tabla del brief, fila 1)—, así que
 * modelarlo como un `membership_role` más obligaría a darle una membresía en
 * cada escuela, justo lo que este mecanismo evita. Sin política propia y sin
 * permisos para `langopia_app`: nadie la lee por SQL directo, solo la función
 * `SECURITY DEFINER` `is_platform_support` (`policies.sql`), con el mismo
 * criterio que ya usan `memberships_for_auth_user` o
 * `school_ids_for_system_jobs`.
 */
export const platformSupportStaff = pgTable("platform_support_staff", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Una sesión de soporte actuando como otra persona (Tarea 17).
 *
 * `schoolId` es la escuela de LA PERSONA IMPERSONADA (`targetMembershipId`),
 * no la de quien impersona —soporte de la plataforma no tiene una propia—,
 * así que esta fila entra en el bucle genérico de `policies.sql` con el
 * tenant de destino, que es exactamente el que hay que aislar: un soporte
 * actuando en la escuela A no debe filtrar su propio rastro hacia la B.
 *
 * `impersonatorUserId` es GLOBAL (`users.id`), no una membresía: soporte de
 * la plataforma puede no tener ninguna. `impersonatorMembershipId` solo se
 * rellena cuando quien impersona SÍ es `owner`/`admin` de la propia escuela.
 * `impersonatorName`/`impersonatorEmail` son una instantánea de la sesión de
 * Better Auth en el momento de empezar: evita depender de un `JOIN` contra
 * `users` que, para un soporte sin membresía en esta escuela, la política
 * `users_visible_within_school` dejaría vacío — la pantalla de auditoría de
 * la propia escuela (paso 12 del brief) tiene que poder enseñar el nombre de
 * todas formas.
 *
 * Caduca a los 30 minutos (`expiresAt`, calculado por el agregado) y no se
 * renueva. `endedAt` queda `NULL` si nadie la cerró a mano y expiró sola: la
 * duración se sigue pudiendo calcular como `LEAST(endedAt, expiresAt) -
 * startedAt`, así que no hace falta una escritura de cierre automática para
 * que el rastro quede completo.
 */
export const impersonations = pgTable(
  "impersonations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    targetMembershipId: uuid("target_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    impersonatorUserId: uuid("impersonator_user_id")
      .notNull()
      .references(() => users.id),
    impersonatorMembershipId: uuid("impersonator_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    impersonatorName: text("impersonator_name").notNull(),
    impersonatorEmail: text("impersonator_email").notNull(),
    reason: text("reason").notNull(),
    /** Actuar como un menor se marca aparte: acceso de un adulto que no es su tutor. */
    involvesMinor: boolean("involves_minor").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("impersonations_school_ix").on(t.schoolId),
    index("impersonations_target_ix").on(t.targetMembershipId),
    index("impersonations_impersonator_ix").on(t.impersonatorUserId),
  ],
);

/**
 * Cliente MCP registrado por una escuela (módulo 8).
 *
 * Los clientes MCP remotos se registran dinámicamente vía OAuth 2.1, así que
 * esta tabla la escribe el propio flujo de registro, no un formulario.
 */
export const mcpClients = pgTable(
  "mcp_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    clientId: text("client_id").notNull(),
    clientSecretHash: text("client_secret_hash"),
    redirectUris: text("redirect_uris")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Qué producto lo registró: claude, chatgpt, custom. */
    clientKind: text("client_kind").notNull().default("custom"),
    authorizedByMembershipId: uuid("authorized_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mcp_clients_client_id_uq").on(t.clientId),
    index("mcp_clients_school_ix").on(t.schoolId),
  ],
);

/**
 * Una llamada a un modelo. Es la tabla que sostiene la economía del producto:
 * sin coste real por generación no se puede cobrar por créditos con margen.
 */
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    kind: aiGenerationKind("kind").notNull(),
    status: aiGenerationStatus("status").notNull().default("queued"),

    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    /** Segundos de audio o número de imágenes, según el tipo. */
    unitsProduced: integer("units_produced").notNull().default(0),

    /** Coste real que te cobra el proveedor. */
    costCents: integer("cost_cents").notNull().default(0),
    /** Créditos descontados a la escuela. La diferencia es tu margen. */
    creditsCharged: integer("credits_charged").notNull().default(0),

    contentUnitId: uuid("content_unit_id").references(() => contentUnits.id, {
      onDelete: "set null",
    }),
    requestedByMembershipId: uuid("requested_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    /** Origen: app, mcp, batch. */
    origin: text("origin").notNull().default("app"),

    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("ai_generations_school_created_ix").on(t.schoolId, t.createdAt),
    index("ai_generations_school_kind_ix").on(t.schoolId, t.kind),
    index("ai_generations_status_ix").on(t.status),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools, { fields: [auditLogs.schoolId], references: [schools.id] }),
  actor: one(memberships, {
    fields: [auditLogs.actorMembershipId],
    references: [memberships.id],
    relationName: "audit_log_actor",
  }),
  impersonator: one(memberships, {
    fields: [auditLogs.impersonatorMembershipId],
    references: [memberships.id],
    relationName: "audit_log_impersonator",
  }),
}));

export const platformSupportStaffRelations = relations(platformSupportStaff, ({ one }) => ({
  user: one(users, { fields: [platformSupportStaff.userId], references: [users.id] }),
}));

export const impersonationsRelations = relations(impersonations, ({ one }) => ({
  school: one(schools, { fields: [impersonations.schoolId], references: [schools.id] }),
  target: one(memberships, {
    fields: [impersonations.targetMembershipId],
    references: [memberships.id],
    relationName: "impersonation_target",
  }),
  impersonator: one(memberships, {
    fields: [impersonations.impersonatorMembershipId],
    references: [memberships.id],
    relationName: "impersonation_impersonator",
  }),
  impersonatorUser: one(users, {
    fields: [impersonations.impersonatorUserId],
    references: [users.id],
  }),
}));

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  school: one(schools, { fields: [aiGenerations.schoolId], references: [schools.id] }),
  unit: one(contentUnits, { fields: [aiGenerations.contentUnitId], references: [contentUnits.id] }),
}));

export const mcpClientsRelations = relations(mcpClients, ({ one }) => ({
  school: one(schools, { fields: [mcpClients.schoolId], references: [schools.id] }),
}));
