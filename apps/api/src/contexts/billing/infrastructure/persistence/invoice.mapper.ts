import * as schema from "@langopia/db/schema";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InvoiceLine } from "../../domain/model/invoice-line.entity.js";
import type { InvoiceDirection } from "../../domain/model/invoice-direction.js";
import type { InvoiceStatus } from "../../domain/model/invoice-status.js";
import { InvoiceId, StudentId } from "../../domain/model/identifiers.js";
import { Invoice } from "../../domain/model/invoice.aggregate.js";

type InvoiceRow = typeof schema.invoices.$inferSelect;
type InvoiceInsert = typeof schema.invoices.$inferInsert;
type InvoiceLineRow = typeof schema.invoiceLines.$inferSelect;
type InvoiceLineInsert = typeof schema.invoiceLines.$inferInsert;

/** Fecha `date` de Postgres a medianoche UTC, igual que en `StudentMapper`/`GroupMapper`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Traductor entre el agregado `Invoice` (con sus líneas) y dos tablas:
 * `invoices` e `invoice_lines`. Sigue el patrón de `GroupMapper`.
 *
 * `amountPaidCents`/`amountRefundedCents`/`amountRefundPendingCents` NO son
 * columnas de `invoices`: se derivan sumando `payments`/`refunds`, así que el
 * repositorio las calcula aparte y se las pasa a `toDomain()` — el mapper solo
 * traduce, no consulta.
 */
export class InvoiceMapper {
  static toDomain(
    row: InvoiceRow,
    lineRows: InvoiceLineRow[],
    amountPaidCents: number,
    amountRefundedCents: number,
    amountRefundPendingCents: number,
  ): Invoice {
    const lines = lineRows
      .sort((a, b) => a.position - b.position)
      .map((l) =>
        InvoiceLine.create({
          id: l.id,
          description: l.description,
          quantity: l.quantity,
          unitCents: l.unitCents,
          courseId: l.courseId,
          sessionId: l.sessionId,
          position: l.position,
        }),
      );

    return Invoice.rehydrate({
      id: InvoiceId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      direction: row.direction as InvoiceDirection,
      studentId: row.studentProfileId ? StudentId.of(row.studentProfileId) : null,
      billToMembershipId: row.billToMembershipId ? MembershipId.of(row.billToMembershipId) : null,
      number: row.number,
      status: row.status as InvoiceStatus,
      currency: row.currency,
      locale: row.locale,
      lines,
      taxRateBps: row.taxRateBps,
      subtotalCents: row.subtotalCents,
      taxCents: row.taxCents,
      totalCents: row.totalCents,
      applicationFeeBps: row.applicationFeeBps,
      applicationFeeCents: row.applicationFeeCents,
      issuedOn: dateOnlyToUtc(row.issuedOn ?? utcToDateOnly(row.createdAt)),
      dueOn: dateOnlyToUtc(row.dueOn ?? utcToDateOnly(row.createdAt)),
      paidAt: row.paidAt,
      amountPaidCents,
      amountRefundedCents,
      amountRefundPendingCents,
    });
  }

  static toPersistence(invoice: Invoice): { invoice: InvoiceInsert; lines: InvoiceLineInsert[] } {
    return {
      invoice: {
        id: invoice.id.value,
        schoolId: invoice.schoolId.value,
        direction: invoice.direction,
        studentProfileId: invoice.studentId?.value ?? null,
        billToMembershipId: invoice.billToMembershipId?.value ?? null,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        locale: invoice.locale,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        taxRateBps: invoice.taxRateBps,
        totalCents: invoice.totalCents,
        applicationFeeBps: invoice.applicationFeeBps,
        applicationFeeCents: invoice.applicationFeeCents,
        issuedOn: utcToDateOnly(invoice.issuedOn),
        dueOn: utcToDateOnly(invoice.dueOn),
        paidAt: invoice.paidAt,
      },
      lines: invoice.lines.map((line) => ({
        id: line.id,
        schoolId: invoice.schoolId.value,
        invoiceId: invoice.id.value,
        description: line.description,
        quantity: line.quantity,
        unitCents: line.unitCents,
        totalCents: line.totalCents,
        courseId: line.courseId,
        sessionId: line.sessionId,
        position: line.position,
      })),
    };
  }
}
