import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  billingInterval,
  creditReason,
  invoiceDirection,
  invoiceStatus,
  paymentMethod,
  paymentProvider,
  paymentStatus,
  refundReason,
  refundStatus,
} from "./enums.js";
import { courses } from "./catalog.js";
import { studentProfiles } from "./people.js";
import { sessions } from "./scheduling.js";
import { memberships, schools } from "./tenancy.js";

/**
 * Plan de la plataforma. Tabla GLOBAL: no lleva `school_id` porque el catálogo
 * de planes es tuyo, no de cada escuela.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    interval: billingInterval("interval").notNull().default("month"),
    /** NULL = sin límite. */
    maxActiveStudents: integer("max_active_students"),
    includedAiCredits: integer("included_ai_credits").notNull().default(0),
    /** Comisión por defecto que se propone a una escuela nueva en este plan. */
    defaultApplicationFeeBps: integer("default_application_fee_bps").notNull().default(0),
    features: jsonb("features")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    providerRef: text("provider_ref"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("plans_code_uq").on(t.code)],
);

/** Suscripción de una escuela a un plan tuyo. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    providerRef: text("provider_ref"),
    status: text("status").notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_school_ix").on(t.schoolId),
    uniqueIndex("subscriptions_provider_ref_uq").on(t.providerRef),
  ],
);

/**
 * Factura. Una sola tabla para los dos sentidos del dinero, distinguidos por
 * `direction`:
 *
 *   platform_to_school  → tu suscripción. Sin comisión.
 *   school_to_student   → la escuela cobra vía su propio proveedor de pago. Aquí sí hay comisión.
 *
 * `applicationFeeBps` se copia de la escuela en el momento de emitir, y no se
 * recalcula después: si mañana subes la comisión, el histórico no cambia.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    direction: invoiceDirection("direction").notNull(),
    /** Solo en `school_to_student`. */
    studentProfileId: uuid("student_profile_id").references(() => studentProfiles.id, {
      onDelete: "set null",
    }),
    /** Quién recibe la factura: el alumno adulto, o el tutor si es menor. */
    billToMembershipId: uuid("bill_to_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),

    number: text("number").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: text("currency").notNull().default("EUR"),
    locale: text("locale").notNull().default("es-ES"),

    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),

    /* — Comisión de plataforma, congelada en el momento de emitir — */
    applicationFeeBps: integer("application_fee_bps").notNull().default(0),
    applicationFeeCents: integer("application_fee_cents").notNull().default(0),

    issuedOn: date("issued_on"),
    dueOn: date("due_on"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),

    providerRef: text("provider_ref"),
    pdfStorageKey: text("pdf_storage_key"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_school_number_uq").on(t.schoolId, t.number),
    index("invoices_school_ix").on(t.schoolId),
    index("invoices_school_status_ix").on(t.schoolId, t.status),
    index("invoices_student_ix").on(t.studentProfileId),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitCents: integer("unit_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    position: smallint("position").notNull().default(1),
  },
  (t) => [
    index("invoice_lines_invoice_ix").on(t.invoiceId),
    index("invoice_lines_school_ix").on(t.schoolId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    status: paymentStatus("status").notNull().default("pending"),
    method: paymentMethod("method").notNull().default("card"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** Comisión efectivamente retenida por la plataforma en este cobro. */
    applicationFeeCents: integer("application_fee_cents").notNull().default(0),
    /** Pasarela que procesó el cobro. Único valor hoy, pero cada fila ya dice de quién es. */
    provider: paymentProvider("provider").notNull().default("stripe"),
    providerRef: text("provider_ref"),
    /** A quién se paga: referencia del comerciante que recibió el dinero. NULL en `platform_to_school`. */
    merchantRef: text("merchant_ref"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_school_ix").on(t.schoolId),
    index("payments_invoice_ix").on(t.invoiceId),
    index("payments_school_status_ix").on(t.schoolId, t.status),
    /**
     * Un cobro del proveedor es UN cobro nuestro. Sin esta restricción, dos
     * entregas del mismo `payment_intent.succeeded` —o dos reintentos con la
     * misma clave de idempotencia— dejaban dos filas por el mismo dinero.
     * Postgres admite varios NULL, así que un cobro todavía sin referencia no
     * choca con nada.
     */
    uniqueIndex("payments_provider_ref_uq").on(t.providerRef),
  ],
);

/**
 * Eventos de webhook del proveedor de pago ya procesados.
 *
 * Los proveedores REENVÍAN eventos por diseño: la misma entrega puede llegar
 * dos veces, y a la vez. Sin esta tabla, dos entregas simultáneas de
 * `payment_intent.succeeded` reconciliaban el mismo cobro dos veces y emitían
 * dos recibos —con el mismo número— y dos correos.
 *
 * La restricción única es por (`provider`, `event_id`) y NO incluye
 * `school_id`: el identificador del evento es único en el proveedor, y dos
 * escuelas no pueden procesar el mismo. El índice actúa por debajo de RLS, así
 * que la segunda entrega choca aunque no pueda ver la fila de la primera.
 */
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull().default("stripe"),
    /** El `id` del evento tal cual lo manda el proveedor (`evt_…` en Stripe). */
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_webhook_events_provider_event_uq").on(t.provider, t.eventId),
    index("payment_webhook_events_school_ix").on(t.schoolId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    reason: refundReason("reason").notNull(),
    status: refundStatus("status").notNull().default("pending"),
    /** Si también se devuelve la parte de comisión de la plataforma. */
    reversesApplicationFee: boolean("reverses_application_fee").notNull().default(true),
    applicationFeeReversedCents: integer("application_fee_reversed_cents").notNull().default(0),
    providerRef: text("provider_ref"),
    requestedByMembershipId: uuid("requested_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("refunds_school_ix").on(t.schoolId),
    index("refunds_payment_ix").on(t.paymentId),
  ],
);

/**
 * Contador de recibos por escuela, año y tipo de documento.
 *
 * Existe porque numerar CONTANDO filas (`SELECT count(*) FROM payments`) no
 * sirve para un documento contable: dos recibos emitidos a la vez cuentan lo
 * mismo y salen con el mismo número, y borrar o anular una fila hace que el
 * siguiente repita uno ya usado. Aquí el número se reserva con un
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING`, que Postgres serializa: dos
 * transacciones simultáneas se llevan números distintos, y ninguno se repite
 * aunque después se borre algo.
 *
 * `kind` separa las series: un cobro (`payment`, `REC-`) y un abono
 * (`credit_note`, `ABN-`) son documentos distintos y no comparten contador.
 */
export const receiptSequences = pgTable(
  "receipt_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** Año natural: la serie vuelve a empezar cada 1 de enero. */
    year: integer("year").notNull(),
    /** `payment` o `credit_note`, el `ReceiptKind` del dominio. */
    kind: text("kind").notNull(),
    /** Último número entregado. El siguiente es este más uno. */
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [uniqueIndex("receipt_sequences_school_year_kind_uq").on(t.schoolId, t.year, t.kind)],
);

/**
 * Libro mayor de créditos de IA. Append-only: nunca se actualiza una fila, se
 * añade otra. `balanceAfter` permite auditar el saldo sin sumar toda la tabla.
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** Positivo al conceder o recargar, negativo al consumir. */
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: creditReason("reason").notNull(),
    /** Coste real en céntimos de lo que se consumió. Para vigilar el margen. */
    costCents: integer("cost_cents").notNull().default(0),
    aiGenerationId: uuid("ai_generation_id"),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    note: text("note"),
    createdByMembershipId: uuid("created_by_membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("credit_ledger_school_ix").on(t.schoolId),
    index("credit_ledger_school_created_ix").on(t.schoolId, t.createdAt),
  ],
);

/* ─── Relaciones ───────────────────────────────────────────────────────── */

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  school: one(schools, { fields: [invoices.schoolId], references: [schools.id] }),
  student: one(studentProfiles, {
    fields: [invoices.studentProfileId],
    references: [studentProfiles.id],
  }),
  lines: many(invoiceLines),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  school: one(schools, { fields: [subscriptions.schoolId], references: [schools.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));
