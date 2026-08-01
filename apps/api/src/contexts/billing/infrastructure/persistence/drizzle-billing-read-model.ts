import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  BillingReadModel,
  InvoiceListItem,
  InvoiceMonthlyTotal,
  MerchantAccountStatus,
  PaymentView,
  RefundView,
} from "../../application/ports/billing-read-model.port.js";

/** `YYYY-MM-DD`, para comparar contra una columna `date` de Postgres. */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `date` de Postgres (`YYYY-MM-DD`) a medianoche UTC, igual que `InvoiceMapper.dateOnlyToUtc`. */
function dateOnlyToIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

/**
 * Lado de lectura de `billing`.
 *
 * SQL a mano, cruzando tablas de otros contextos (`memberships`, `users`)
 * para el nombre de a quién se factura — igual que hace
 * `DrizzleSchedulingReadModel` con `teacher_profiles`/`users`. El aislamiento
 * sigue garantizado por RLS: la conexión lleva el rol sin `BYPASSRLS`.
 *
 * Cada método pasa por `uow.read(...)`, incluida `merchantStatus()` (un
 * `SELECT ... FROM schools LIMIT 1` sin filtrar por escuela a mano): fuera de
 * una transacción con `app.school_id` fijado, esa consulta devolvería la
 * primera escuela del seed en vez de la activa — el mismo fallo, ya
 * encontrado y corregido, que describe `GetSchoolTimezoneHandler` (Tarea 9).
 */
@Injectable()
export class DrizzleBillingReadModel implements BillingReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async listInvoices(params: { status?: string }): Promise<InvoiceListItem[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        invoice_id: string;
        number: string;
        direction: string;
        status: string;
        currency: string;
        billed_to_name: string | null;
        total_cents: number;
        amount_paid_cents: string;
        amount_refunded_cents: string;
        has_failed_payment: boolean;
        issued_on: string | null;
        due_on: string | null;
        paid_at: Date | null;
      }>(sql`
        SELECT
          i.id                  AS invoice_id,
          i.number,
          i.direction::text     AS direction,
          i.status::text        AS status,
          i.currency,
          u.name                AS billed_to_name,
          i.total_cents,
          COALESCE(pay.amount_paid_cents, 0)     AS amount_paid_cents,
          COALESCE(ref.amount_refunded_cents, 0) AS amount_refunded_cents,
          COALESCE(pay.has_failed_payment, false) AS has_failed_payment,
          i.issued_on::text     AS issued_on,
          i.due_on::text        AS due_on,
          i.paid_at
        FROM invoices i
        LEFT JOIN memberships m ON m.id = i.bill_to_membership_id
        LEFT JOIN users u       ON u.id = m.user_id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(p.amount_cents) FILTER (
              WHERE p.status IN ('succeeded', 'refunded', 'partially_refunded')
            ), 0)                       AS amount_paid_cents,
            bool_or(p.status = 'failed') AS has_failed_payment
          FROM payments p
          WHERE p.invoice_id = i.id
        ) pay ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(r.amount_cents) FILTER (WHERE r.status = 'succeeded'), 0) AS amount_refunded_cents
          FROM refunds r
          JOIN payments p2 ON p2.id = r.payment_id
          WHERE p2.invoice_id = i.id
        ) ref ON true
        ${params.status ? sql`WHERE i.status = ${params.status}` : sql``}
        ORDER BY i.issued_on DESC NULLS LAST, i.created_at DESC
      `);

      return rows.map((r) => ({
        invoiceId: r.invoice_id,
        number: r.number,
        direction: r.direction,
        status: r.status,
        currency: r.currency,
        billedToName: r.billed_to_name,
        totalCents: Number(r.total_cents),
        amountPaidCents: Number(r.amount_paid_cents),
        amountRefundedCents: Number(r.amount_refunded_cents),
        hasFailedPayment: Boolean(r.has_failed_payment),
        issuedOn: r.issued_on ? dateOnlyToIso(r.issued_on) : null,
        dueOn: r.due_on ? dateOnlyToIso(r.due_on) : null,
        paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      }));
    });
  }

  async monthlyTotal(params: { from: Date; to: Date }): Promise<InvoiceMonthlyTotal> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ amount_cents: string; currency: string }>(sql`
        SELECT
          COALESCE(SUM(i.total_cents), 0)::text AS amount_cents,
          (SELECT currency FROM schools LIMIT 1) AS currency
        FROM invoices i
        WHERE i.direction = 'school_to_student'
          AND i.issued_on IS NOT NULL
          AND i.issued_on >= ${isoDate(params.from)}::date
          AND i.issued_on <  ${isoDate(params.to)}::date
      `);
      return {
        totalCents: Number(rows[0]?.amount_cents ?? 0),
        currency: rows[0]?.currency ?? "EUR",
      };
    });
  }

  async billedToName(membershipId: string | null): Promise<string | null> {
    if (!membershipId) return null;
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ name: string }>(sql`
        SELECT u.name
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.id = ${membershipId}
      `);
      return rows[0]?.name ?? null;
    });
  }

  async paymentsForInvoice(invoiceId: string): Promise<PaymentView[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        id: string;
        status: string;
        method: string;
        amount_cents: number;
        currency: string;
        application_fee_cents: number;
        provider: string;
        paid_at: Date | null;
        failure_code: string | null;
        failure_message: string | null;
        created_at: Date;
      }>(sql`
        SELECT id, status::text AS status, method::text AS method, amount_cents, currency,
               application_fee_cents, provider::text AS provider, paid_at, failure_code,
               failure_message, created_at
        FROM payments
        WHERE invoice_id = ${invoiceId}
        ORDER BY created_at ASC
      `);

      return rows.map((r) => ({
        paymentId: r.id,
        status: r.status,
        method: r.method,
        amountCents: Number(r.amount_cents),
        currency: r.currency,
        applicationFeeCents: Number(r.application_fee_cents),
        provider: r.provider,
        paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
        failureCode: r.failure_code,
        failureMessage: r.failure_message,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    });
  }

  async refundsForInvoice(invoiceId: string): Promise<RefundView[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        id: string;
        payment_id: string;
        amount_cents: number;
        currency: string;
        reason: string;
        status: string;
        reverses_application_fee: boolean;
        application_fee_reversed_cents: number;
        note: string | null;
        created_at: Date;
        processed_at: Date | null;
      }>(sql`
        SELECT rf.id, rf.payment_id, rf.amount_cents, rf.currency, rf.reason::text AS reason,
               rf.status::text AS status, rf.reverses_application_fee,
               rf.application_fee_reversed_cents, rf.note, rf.created_at, rf.processed_at
        FROM refunds rf
        JOIN payments p ON p.id = rf.payment_id
        WHERE p.invoice_id = ${invoiceId}
        ORDER BY rf.created_at ASC
      `);

      return rows.map((r) => ({
        refundId: r.id,
        paymentId: r.payment_id,
        amountCents: Number(r.amount_cents),
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        reversesApplicationFee: r.reverses_application_fee,
        applicationFeeReversedCents: Number(r.application_fee_reversed_cents),
        note: r.note,
        createdAt: new Date(r.created_at).toISOString(),
        processedAt: r.processed_at ? new Date(r.processed_at).toISOString() : null,
      }));
    });
  }

  async merchantStatus(): Promise<MerchantAccountStatus> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        merchant_status: string;
        application_fee_enabled: boolean;
        application_fee_bps: number;
        application_fee_cap_cents: number | null;
        currency: string;
      }>(sql`
        SELECT merchant_status::text AS merchant_status, application_fee_enabled,
               application_fee_bps, application_fee_cap_cents, currency
        FROM schools
        LIMIT 1
      `);
      const row = rows[0];
      return {
        merchantStatus: (row?.merchant_status ??
          "not_started") as MerchantAccountStatus["merchantStatus"],
        applicationFeeEnabled: row?.application_fee_enabled ?? false,
        applicationFeeBps: row?.application_fee_bps ?? 0,
        applicationFeeCapCents: row?.application_fee_cap_cents ?? null,
        currency: row?.currency ?? "EUR",
      };
    });
  }
}
