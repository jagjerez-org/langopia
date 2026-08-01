import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  InvoiceDirectoryPort,
  InvoicePayerContext,
} from "../../domain/ports/invoice-directory.port.js";

/** Lee `invoices`, de `billing`, sin importar `Invoice` ni su repositorio. */
@Injectable()
export class DrizzleInvoiceDirectoryRepository implements InvoiceDirectoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findPayerContext(invoiceId: string): Promise<InvoicePayerContext | null> {
    const rows = await this.drizzle.db.execute<{
      bill_to_membership_id: string | null;
      student_profile_id: string | null;
      number: string;
      currency: string;
      due_on: Date | string | null;
    }>(sql`
      SELECT bill_to_membership_id, student_profile_id, number, currency, due_on
      FROM invoices
      WHERE id = ${invoiceId}
    `);
    const row = rows[0];
    if (!row) return null;

    return {
      billToMembershipId: row.bill_to_membership_id,
      studentId: row.student_profile_id,
      number: row.number,
      currency: row.currency,
      dueOn: row.due_on ? new Date(row.due_on) : null,
    };
  }
}
