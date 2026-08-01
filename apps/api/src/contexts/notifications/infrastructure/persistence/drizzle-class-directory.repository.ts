import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ClassDirectoryPort,
  UpcomingSession,
} from "../../domain/ports/class-directory.port.js";

/**
 * Lee `enrollments`, `sessions` y `attendance` — de `catalog` y `scheduling`,
 * ninguna propia de `notifications` — sin importar ningún agregado de esos
 * contextos. Mismo reparto que las capas anticorrupción de `scheduling` hacia
 * `people`: el acceso a datos vive aquí, en `infrastructure/persistence/`.
 */
@Injectable()
export class DrizzleClassDirectoryRepository implements ClassDirectoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async activeStudentIds(groupId: string): Promise<string[]> {
    const rows = await this.drizzle.db.execute<{ student_profile_id: string }>(sql`
      SELECT student_profile_id
      FROM enrollments
      WHERE group_id = ${groupId} AND status = 'active'
    `);
    return rows.map((row) => row.student_profile_id);
  }

  async groupIdForSession(sessionId: string): Promise<string | null> {
    const rows = await this.drizzle.db.execute<{ group_id: string }>(sql`
      SELECT group_id FROM sessions WHERE id = ${sessionId}
    `);
    return rows[0]?.group_id ?? null;
  }

  async attendedStudentIds(sessionId: string): Promise<string[]> {
    const rows = await this.drizzle.db.execute<{ student_profile_id: string }>(sql`
      SELECT student_profile_id
      FROM attendance
      WHERE session_id = ${sessionId} AND status IN ('present', 'late')
    `);
    return rows.map((row) => row.student_profile_id);
  }

  async scheduledSessionsStartingBetween(from: Date, to: Date): Promise<UpcomingSession[]> {
    const rows = await this.drizzle.db.execute<{
      session_id: string;
      group_id: string;
      scheduled_start: Date;
    }>(sql`
      SELECT id AS session_id, group_id, scheduled_start
      FROM sessions
      WHERE status = 'scheduled'
        AND scheduled_start >= ${from.toISOString()}::timestamptz
        AND scheduled_start <  ${to.toISOString()}::timestamptz
    `);
    return rows.map((row) => ({
      sessionId: row.session_id,
      groupId: row.group_id,
      start: new Date(row.scheduled_start),
    }));
  }
}
