import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { SessionParticipationPort } from "../../domain/ports/session-participation.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Una sola pregunta, un solo `EXISTS`.
 *
 * Cruza `sessions` (de `scheduling`), `enrollments` (de `catalog`) y
 * `student_profiles`/`guardians` (de `people`) por el mismo motivo por el que
 * `DrizzleSessionRoomRepository` toca `sessions`: es lectura de
 * infraestructura, no un agregado ajeno cargado desde otro contexto. Ninguna
 * consulta filtra por `school_id` a mano — la unidad de trabajo fija
 * `app.school_id` y RLS filtra por debajo, así que una clase de otra escuela
 * ni siquiera se ve.
 *
 * El tutor entra por el `LEFT JOIN` con `guardians`: acompañar a un menor a
 * su clase es un caso real, y sin esa rama un tutor con `role = 'guardian'`
 * se quedaría fuera de la clase de su propio hijo.
 */
@Injectable()
export class DrizzleSessionParticipationRepository implements SessionParticipationPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async isEnrolledInSessionGroup(sessionId: string, membershipId: string): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ enrolled: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM sessions s
        JOIN enrollments e      ON e.group_id = s.group_id AND e.status = 'active'
        JOIN student_profiles p ON p.id = e.student_profile_id
        LEFT JOIN guardians g   ON g.student_profile_id = p.id
        WHERE s.id = ${sessionId}
          AND (p.membership_id = ${membershipId} OR g.membership_id = ${membershipId})
      ) AS enrolled
    `);
    return rows[0]?.enrolled ?? false;
  }
}
