import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Invoice } from "../../domain/model/invoice.aggregate.js";
import { InvoiceId } from "../../domain/model/identifiers.js";
import type { ReceiptKind } from "../../domain/model/receipt.js";
import type {
  InvoiceRepository,
  PaidSessionCharge,
} from "../../domain/ports/invoice.repository.port.js";
import { PaymentProvider, type ProviderRef } from "../../domain/ports/payment-gateway.port.js";
import { InvoiceMapper } from "./invoice.mapper.js";

/** Un pago cuenta como «cobrado» aunque luego se haya devuelto: eso lo dice `refunds`, no `payments`. */
const COLLECTED_PAYMENT_STATUSES = ["succeeded", "refunded", "partially_refunded"] as const;

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que las
 * políticas RLS lo filtran todo por debajo — igual que
 * `DrizzleClassSessionRepository` en `scheduling`.
 */
@Injectable()
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: InvoiceId): Promise<Invoice | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const lineRows = await this.drizzle.db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.invoiceId, row.id));

    const { amountPaidCents, amountRefundedCents, amountRefundPendingCents } =
      await this.amountsFor(row.id);

    return InvoiceMapper.toDomain(
      row,
      lineRows,
      amountPaidCents,
      amountRefundedCents,
      amountRefundPendingCents,
    );
  }

  async findOrFail(id: InvoiceId): Promise<Invoice> {
    const invoice = await this.find(id);
    if (!invoice) throw new NotFoundError("la factura", id.value);
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const { invoice: row, lines } = InvoiceMapper.toPersistence(invoice);

    await this.drizzle.db
      .insert(schema.invoices)
      .values(row)
      .onConflictDoUpdate({
        target: schema.invoices.id,
        set: { status: row.status, paidAt: row.paidAt ?? null },
      });

    // En serie y dentro de la transacción del `uow`, igual que `GroupMapper`:
    // pocas líneas por factura, y todas o ninguna.
    for (const line of lines) {
      await this.drizzle.db
        .insert(schema.invoiceLines)
        .values(line)
        .onConflictDoUpdate({
          target: schema.invoiceLines.id,
          set: {
            description: line.description,
            quantity: line.quantity,
            unitCents: line.unitCents,
            totalCents: line.totalCents,
          },
        });
    }
  }

  /** Correlativo por año natural — no se resetea por escuela dentro de un mismo `SELECT count`, RLS ya limita a la activa. */
  async nextInvoiceNumber(year: number): Promise<number> {
    const rows = await this.drizzle.db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM invoices
          WHERE issued_on >= ${`${year}-01-01`}::date AND issued_on < ${`${year + 1}-01-01`}::date`,
    );
    return Number(rows[0]?.count ?? 0) + 1;
  }

  /**
   * Reserva el siguiente número de recibo. No cuenta filas: las incrementa.
   *
   * `INSERT … ON CONFLICT DO UPDATE … RETURNING` es atómico y Postgres lo
   * serializa —la segunda transacción espera a la primera y se lleva el
   * siguiente número—, así que dos recibos simultáneos no pueden salir con el
   * mismo número. Contar filas de `payments`, como se hacía antes, tenía los
   * dos fallos: dos cobros a la vez contaban lo mismo, y cualquier borrado
   * hacía repetir un número ya emitido.
   */
  async nextReceiptSequence(params: {
    schoolId: string;
    year: number;
    kind: ReceiptKind;
  }): Promise<number> {
    const rows = await this.drizzle.db.execute<{ last_value: number }>(
      sql`INSERT INTO receipt_sequences (school_id, year, kind, last_value)
          VALUES (${params.schoolId}::uuid, ${params.year}, ${params.kind}, 1)
          ON CONFLICT (school_id, year, kind)
          DO UPDATE SET last_value = receipt_sequences.last_value + 1
          RETURNING last_value`,
    );
    const lastValue = rows[0]?.last_value;
    if (lastValue == null) throw new Error("No se pudo reservar el número de recibo.");
    return Number(lastValue);
  }

  async recordPayment(params: {
    schoolId: string;
    invoiceId: InvoiceId;
    amountCents: number;
    currency: string;
    method: string;
    applicationFeeCents: number;
    charge: ProviderRef;
    merchantRef: string | null;
    status: "succeeded" | "pending" | "failed";
    failureCode?: string | null;
    failureMessage?: string | null;
    paidAt: Date | null;
  }): Promise<{ paymentId: string }> {
    const [row] = await this.drizzle.db
      .insert(schema.payments)
      .values({
        schoolId: params.schoolId,
        invoiceId: params.invoiceId.value,
        status: params.status,
        method: params.method as (typeof schema.paymentMethod.enumValues)[number],
        amountCents: params.amountCents,
        currency: params.currency,
        applicationFeeCents: params.status === "succeeded" ? params.applicationFeeCents : 0,
        provider: params.charge.provider,
        providerRef: params.charge.ref,
        merchantRef: params.merchantRef,
        paidAt: params.paidAt,
        failureCode: params.failureCode ?? null,
        failureMessage: params.failureMessage ?? null,
      })
      // Un cobro del proveedor es UN cobro nuestro (`payments_provider_ref_uq`).
      // `DO NOTHING` en vez de dejar reventar la restricción: un reintento con
      // la misma clave de idempotencia devuelve la MISMA referencia del
      // proveedor, y lo correcto entonces es devolver la fila que ya existe,
      // no crear una segunda por el mismo dinero ni pisar su estado.
      .onConflictDoNothing({ target: schema.payments.providerRef })
      .returning({ id: schema.payments.id });
    if (row) return { paymentId: row.id };

    const existing = await this.drizzle.db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.providerRef, params.charge.ref))
      .limit(1);
    const alreadyThere = existing[0];
    if (!alreadyThere) throw new Error("No se pudo registrar el cobro.");
    return { paymentId: alreadyThere.id };
  }

  async recordRefund(params: {
    schoolId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
    reason: string;
    applicationFeeReversedCents: number;
    refund: ProviderRef;
    status: "succeeded" | "pending" | "failed";
    requestedByMembershipId: string | null;
    fullyRefunded: boolean;
    now: Date;
  }): Promise<{ refundId: string }> {
    const [row] = await this.drizzle.db
      .insert(schema.refunds)
      .values({
        schoolId: params.schoolId,
        paymentId: params.paymentId,
        amountCents: params.amountCents,
        currency: params.currency,
        reason: params.reason as (typeof schema.refundReason.enumValues)[number],
        status: params.status,
        reversesApplicationFee: params.applicationFeeReversedCents > 0,
        applicationFeeReversedCents: params.applicationFeeReversedCents,
        providerRef: params.refund.ref,
        requestedByMembershipId: params.requestedByMembershipId,
        createdAt: params.now,
        processedAt: params.status === "succeeded" ? params.now : null,
      })
      .returning({ id: schema.refunds.id });
    if (!row) throw new Error("No se pudo registrar la devolución.");

    if (params.status === "succeeded") {
      await this.drizzle.db
        .update(schema.payments)
        .set({ status: params.fullyRefunded ? "refunded" : "partially_refunded" })
        .where(eq(schema.payments.id, params.paymentId));
    }

    return { refundId: row.id };
  }

  /**
   * TODAS las facturas con una línea de esta sesión, no la primera que
   * aparezca: en una clase de grupo hay una factura por matriculado, y el
   * `limit 1` que había aquí dejaba sin devolución a las otras siete personas
   * de un grupo de ocho mientras el registro decía «devolución abierta».
   */
  async findPaidChargesForSession(sessionId: string): Promise<PaidSessionCharge[]> {
    const lines = await this.drizzle.db
      .selectDistinct({ invoiceId: schema.invoiceLines.invoiceId })
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.sessionId, sessionId))
      .orderBy(schema.invoiceLines.invoiceId);

    const charges: PaidSessionCharge[] = [];
    for (const line of lines) {
      const payment = await this.latestPaymentFor(line.invoiceId);
      if (!payment) continue;

      // El importe NO sale de `invoice_lines.total_cents`: esa columna es
      // antes de impuestos. Quién sabe cuánto se cobró de verdad por esta
      // línea es la factura (`grossAmountForSession`), y las cuentas de
      // dinero se hacen en el dominio, no en el SELECT.
      const invoice = await this.find(InvoiceId.of(line.invoiceId));
      const amount = invoice?.grossAmountForSession(sessionId) ?? null;
      if (!amount || amount.cents === 0) continue;

      charges.push({
        invoiceId: line.invoiceId,
        paymentId: payment.id,
        charge: { provider: payment.provider as PaymentProvider, ref: payment.providerRef ?? "" },
        lineAmountCents: amount.cents,
        currency: payment.currency,
      });
    }
    return charges;
  }

  async findLatestSucceededPayment(
    invoiceId: InvoiceId,
  ): Promise<{ paymentId: string; charge: ProviderRef } | null> {
    const payment = await this.latestPaymentFor(invoiceId.value);
    if (!payment) return null;
    return {
      paymentId: payment.id,
      charge: { provider: payment.provider as PaymentProvider, ref: payment.providerRef ?? "" },
    };
  }

  async findPaymentByProviderRef(providerRef: string): Promise<{
    paymentId: string;
    invoiceId: string;
    status: "succeeded" | "pending" | "failed";
    amountCents: number;
    currency: string;
    method: string;
  } | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.providerRef, providerRef))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      paymentId: row.id,
      invoiceId: row.invoiceId,
      status: row.status as "succeeded" | "pending" | "failed",
      amountCents: row.amountCents,
      currency: row.currency,
      method: row.method,
    };
  }

  async markPaymentSucceeded(params: {
    paymentId: string;
    amountCents: number;
    currency: string;
    applicationFeeCents: number;
    paidAt: Date;
  }): Promise<void> {
    await this.drizzle.db
      .update(schema.payments)
      .set({
        status: "succeeded",
        // El importe del evento del proveedor, que manda sobre el que se
        // guardó al abrir el cobro.
        amountCents: params.amountCents,
        currency: params.currency,
        applicationFeeCents: params.applicationFeeCents,
        paidAt: params.paidAt,
      })
      .where(eq(schema.payments.id, params.paymentId));
  }

  async findRefundByProviderRef(providerRef: string): Promise<{
    refundId: string;
    invoiceId: string;
    status: "succeeded" | "pending" | "failed";
    amountCents: number;
    currency: string;
    reason: string;
  } | null> {
    const rows = await this.drizzle.db
      .select({
        id: schema.refunds.id,
        amountCents: schema.refunds.amountCents,
        currency: schema.refunds.currency,
        status: schema.refunds.status,
        reason: schema.refunds.reason,
        invoiceId: schema.payments.invoiceId,
      })
      .from(schema.refunds)
      .innerJoin(schema.payments, eq(schema.payments.id, schema.refunds.paymentId))
      .where(eq(schema.refunds.providerRef, providerRef))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      refundId: row.id,
      invoiceId: row.invoiceId,
      status: row.status as "succeeded" | "pending" | "failed",
      amountCents: row.amountCents,
      currency: row.currency,
      reason: row.reason,
    };
  }

  async markRefundSucceeded(params: {
    refundId: string;
    applicationFeeReversedCents: number;
    processedAt: Date;
    fullyRefunded: boolean;
  }): Promise<void> {
    const [refund] = await this.drizzle.db
      .update(schema.refunds)
      .set({
        status: "succeeded",
        applicationFeeReversedCents: params.applicationFeeReversedCents,
        reversesApplicationFee: params.applicationFeeReversedCents > 0,
        processedAt: params.processedAt,
      })
      .where(eq(schema.refunds.id, params.refundId))
      .returning({ paymentId: schema.refunds.paymentId });
    if (!refund) return;

    await this.drizzle.db
      .update(schema.payments)
      .set({ status: params.fullyRefunded ? "refunded" : "partially_refunded" })
      .where(eq(schema.payments.id, refund.paymentId));
  }

  private async latestPaymentFor(invoiceId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.invoiceId, invoiceId))
      .orderBy(desc(schema.payments.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row || !COLLECTED_PAYMENT_STATUSES.includes(row.status as (typeof COLLECTED_PAYMENT_STATUSES)[number])) {
      return null;
    }
    return row;
  }

  /**
   * Suma en el propio Postgres, no trayendo filas para sumarlas en JS: un
   * `SUM()` entero sobre una columna entera es exactamente la aritmética que
   * este módulo exige en todas partes, y evita transportar cada fila de
   * `payments`/`refunds` solo para descartarla después de sumarla.
   */
  private async amountsFor(invoiceId: string): Promise<{
    amountPaidCents: number;
    amountRefundedCents: number;
    amountRefundPendingCents: number;
  }> {
    const [paid] = await this.drizzle.db
      .select({ paymentIds: sql<string[]>`coalesce(array_agg(${schema.payments.id}), '{}')`, amountPaidCents: sql<string>`coalesce(sum(${schema.payments.amountCents}), 0)::text` })
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.invoiceId, invoiceId),
          inArray(schema.payments.status, [...COLLECTED_PAYMENT_STATUSES]),
        ),
      );

    const amountPaidCents = Number(paid?.amountPaidCents ?? "0");
    const paymentIds = paid?.paymentIds ?? [];
    if (paymentIds.length === 0) {
      return { amountPaidCents, amountRefundedCents: 0, amountRefundPendingCents: 0 };
    }

    // Dos sumas, no una: lo devuelto de verdad y lo que está pedido al
    // proveedor sin confirmar todavía. Lo segundo NO es dinero devuelto —no
    // puede contarse como tal— pero sí es dinero comprometido, y el agregado
    // lo descuenta del tope para que no se pueda abrir una segunda devolución
    // por el importe entero mientras la primera sigue en el aire.
    const [sums] = await this.drizzle.db
      .select({
        amountRefundedCents: sql<string>`coalesce(sum(${schema.refunds.amountCents}) filter (where ${schema.refunds.status} = 'succeeded'), 0)::text`,
        amountRefundPendingCents: sql<string>`coalesce(sum(${schema.refunds.amountCents}) filter (where ${schema.refunds.status} = 'pending'), 0)::text`,
      })
      .from(schema.refunds)
      .where(inArray(schema.refunds.paymentId, paymentIds));

    return {
      amountPaidCents,
      amountRefundedCents: Number(sums?.amountRefundedCents ?? "0"),
      amountRefundPendingCents: Number(sums?.amountRefundPendingCents ?? "0"),
    };
  }
}
