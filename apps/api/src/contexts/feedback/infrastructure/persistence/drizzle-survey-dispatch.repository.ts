import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  SurveyDispatchPort,
  SurveyRespondent,
} from "../../domain/ports/survey-dispatch.port.js";
import type { RespondentKind } from "../../domain/model/survey-types.js";

@Injectable()
export class DrizzleSurveyDispatchRepository implements SurveyDispatchPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async attendedRespondents(sessionId: string): Promise<SurveyRespondent[]> {
    const rows = await this.drizzle.db.execute<{ membership_id: string; respondent_kind: RespondentKind }>(sql`
      SELECT sp.membership_id AS membership_id, 'student'::text AS respondent_kind
      FROM attendance a
      JOIN student_profiles sp ON sp.id = a.student_profile_id
      WHERE a.session_id = ${sessionId}
        AND a.status IN ('present', 'late')
      ORDER BY sp.membership_id
    `);

    return rows.map((row) => ({
      membershipId: row.membership_id,
      respondentKind: row.respondent_kind,
    }));
  }

  async canRespondToSession(params: {
    respondentMembershipId: string;
    respondentKind: RespondentKind;
    sessionId: string;
  }): Promise<boolean> {
    if (params.respondentKind === "teacher") return false;
    const rows = await this.drizzle.db.execute<{ allowed: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM attendance a
        JOIN student_profiles sp ON sp.id = a.student_profile_id
        LEFT JOIN guardians g ON g.student_profile_id = sp.id
        WHERE a.session_id = ${params.sessionId}
          AND a.status IN ('present', 'late')
          AND (
            sp.membership_id = ${params.respondentMembershipId}
            OR g.membership_id = ${params.respondentMembershipId}
          )
      ) AS allowed
    `);
    return rows[0]?.allowed ?? false;
  }

  async sendPostSessionSurvey(): Promise<void> {
    // El envío real por email ya vive en `notifications`, que escucha el mismo evento.
    // Este puerto deja el contexto `feedback` decidir destinatarios sin acoplarse a correo.
  }
}

