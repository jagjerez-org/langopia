import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { MinorGuardianContext } from "../../domain/ports/minor-guardian-lookup.port.js";

/**
 * Lee `student_profiles` y `guardians` —tablas de `people`, ninguna propia
 * de `iam`— dentro de la transacción en curso: el tenant ya está fijado a la
 * escuela de la persona impersonada, así que RLS aísla igual que en
 * cualquier otro repositorio. `PeopleMinorGuardianAdapter`
 * (`infrastructure/acl/`) es quien lo expone al resto de `iam`; este fichero
 * solo escribe el SQL, como pide `ARCHITECTURE.md`.
 */
@Injectable()
export class DrizzleMinorGuardianRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async contextFor(membershipId: string): Promise<MinorGuardianContext> {
    const studentRows = await this.drizzle.db.execute<{
      id: string;
      guardian_required: boolean;
    }>(sql`
      SELECT id, guardian_required
      FROM student_profiles
      WHERE membership_id = ${membershipId}
    `);
    const student = studentRows[0];
    if (!student || !student.guardian_required) {
      return { isMinor: false, guardianMembershipIds: [] };
    }

    const guardianRows = await this.drizzle.db.execute<{ membership_id: string }>(sql`
      SELECT membership_id
      FROM guardians
      WHERE student_profile_id = ${student.id}
      ORDER BY created_at ASC
    `);

    return {
      isMinor: true,
      guardianMembershipIds: guardianRows.map((row) => row.membership_id),
    };
  }
}
