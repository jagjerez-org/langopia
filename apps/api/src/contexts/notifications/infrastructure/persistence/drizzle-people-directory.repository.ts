import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import type { GuardianCandidate, RecipientCandidate } from "../../domain/model/recipient.js";

type CandidateRow = {
  membership_id: string;
  email: string;
  name: string;
  membership_locale: string | null;
  user_locale: string;
};

type GuardianRow = CandidateRow & { is_billing_contact: boolean };

function toCandidate(row: CandidateRow): RecipientCandidate {
  return {
    membershipId: row.membership_id,
    email: row.email,
    name: row.name,
    membershipLocale: row.membership_locale,
    userLocale: row.user_locale,
  };
}

/**
 * Lee de `student_profiles`, `guardians`, `memberships` y `users` — tablas de
 * `people` y de tenancy, ninguna propia de `notifications` — igual que
 * `DrizzlePeopleReadModel` cruza esas mismas tablas desde dentro de `people`.
 * RLS sigue aislando por escuela aunque la consulta viva en otro contexto.
 */
@Injectable()
export class DrizzlePeopleDirectoryRepository implements PeopleDirectoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findStudentRecipientContext(studentId: string): Promise<StudentRecipientContext | null> {
    const studentRows = await this.drizzle.db.execute<CandidateRow & { guardian_required: boolean }>(
      sql`
        SELECT
          sp.guardian_required     AS guardian_required,
          m.id                     AS membership_id,
          m.locale                 AS membership_locale,
          u.email                  AS email,
          u.name                   AS name,
          u.locale                 AS user_locale
        FROM student_profiles sp
        JOIN memberships m ON m.id = sp.membership_id
        JOIN users u       ON u.id = m.user_id
        WHERE sp.id = ${studentId}
      `,
    );
    const studentRow = studentRows[0];
    if (!studentRow) return null;

    const guardianRows = await this.drizzle.db.execute<GuardianRow>(sql`
      SELECT
        g.is_billing_contact AS is_billing_contact,
        m.id                  AS membership_id,
        m.locale              AS membership_locale,
        u.email               AS email,
        u.name                AS name,
        u.locale              AS user_locale
      FROM guardians g
      JOIN memberships m ON m.id = g.membership_id
      JOIN users u       ON u.id = m.user_id
      WHERE g.student_profile_id = ${studentId}
      ORDER BY g.created_at ASC
    `);

    const guardians: GuardianCandidate[] = guardianRows.map((row) => ({
      ...toCandidate(row),
      isBillingContact: row.is_billing_contact,
    }));

    return {
      isMinor: studentRow.guardian_required,
      student: toCandidate(studentRow),
      guardians,
    };
  }

  async findMembershipRecipient(membershipId: string): Promise<RecipientCandidate | null> {
    const rows = await this.drizzle.db.execute<CandidateRow>(sql`
      SELECT
        m.id     AS membership_id,
        m.locale AS membership_locale,
        u.email  AS email,
        u.name   AS name,
        u.locale AS user_locale
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ${membershipId}
    `);
    const row = rows[0];
    return row ? toCandidate(row) : null;
  }
}
