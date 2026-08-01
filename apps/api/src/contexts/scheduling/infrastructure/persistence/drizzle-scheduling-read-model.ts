import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  AgendaEntry,
  GroupRosterMember,
  SchedulingReadModel,
  TeacherOccupancy,
} from "../../application/ports/scheduling-read-model.port.js";

/**
 * Lado de lectura.
 *
 * Aquí se escribe SQL a mano, se cruzan tablas de otros contextos y se
 * devuelven estructuras planas. Nada de esto pasa por el dominio, y es lo
 * correcto: pintar un calendario no requiere ninguna invariante.
 *
 * El aislamiento sigue garantizado por RLS aunque estas consultas toquen
 * tablas de varios contextos: la conexión lleva el rol sin BYPASSRLS.
 *
 * Las fechas se interpolan como ISO 8601 con `::timestamptz` explícito. En
 * SQL crudo los parámetros van directos al driver, sin el mapeo de tipos que
 * Drizzle aplica en el constructor de consultas, y un `Date` de JavaScript
 * llega ahí como objeto y revienta.
 */
@Injectable()
export class DrizzleSchedulingReadModel implements SchedulingReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async agendaBetween(params: {
    from: Date;
    to: Date;
    teacherId?: string;
    groupId?: string;
  }): Promise<AgendaEntry[]> {
    return this.uow.read(async () => this.agendaQuery(params));
  }

  private async agendaQuery(params: {
    from: Date;
    to: Date;
    teacherId?: string;
    groupId?: string;
  }): Promise<AgendaEntry[]> {
    const rows = await this.drizzle.db.execute<{
      session_id: string;
      group_id: string;
      group_name: string;
      course_code: string;
      teacher_id: string | null;
      teacher_name: string | null;
      start: Date;
      end: Date;
      status: string;
      room_provider: string;
      room_url: string | null;
      topic: string | null;
      enrolled_students: number;
    }>(sql`
      SELECT
        s.id                  AS session_id,
        g.id                  AS group_id,
        g.name                AS group_name,
        c.code                AS course_code,
        tp.id                 AS teacher_id,
        tu.name               AS teacher_name,
        s.scheduled_start     AS start,
        s.scheduled_end       AS "end",
        s.status::text        AS status,
        s.room_provider::text AS room_provider,
        s.room_url,
        s.topic,
        (SELECT count(*)::int FROM enrollments e
          WHERE e.group_id = g.id AND e.status = 'active') AS enrolled_students
      FROM sessions s
      JOIN groups  g ON g.id = s.group_id
      JOIN courses c ON c.id = g.course_id
      LEFT JOIN teacher_profiles tp ON tp.id = s.teacher_profile_id
      LEFT JOIN memberships tm      ON tm.id = tp.membership_id
      LEFT JOIN users tu            ON tu.id = tm.user_id
      WHERE s.scheduled_start >= ${params.from.toISOString()}::timestamptz
        AND s.scheduled_start <  ${params.to.toISOString()}::timestamptz
        ${params.teacherId ? sql`AND tp.id = ${params.teacherId}` : sql``}
        ${params.groupId ? sql`AND g.id = ${params.groupId}` : sql``}
      ORDER BY s.scheduled_start
    `);

    return rows.map((r) => ({
      sessionId: r.session_id,
      groupId: r.group_id,
      groupName: r.group_name,
      courseCode: r.course_code,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      start: new Date(r.start).toISOString(),
      end: new Date(r.end).toISOString(),
      status: r.status,
      roomProvider: r.room_provider,
      roomUrl: r.room_url,
      topic: r.topic,
      enrolledStudents: Number(r.enrolled_students),
    }));
  }

  /**
   * Ocupación del profesorado. Es la consulta que alimenta el panel de
   * dirección.
   *
   * Cuenta lo programado y lo impartido; deja fuera lo cancelado y lo
   * replanificado, porque una clase que se movió no consume horas dos veces.
   * Las horas contratadas se prorratean al número de semanas del periodo para
   * que un rango de dos semanas no dé 200 % de ocupación.
   */
  async teacherOccupancyBetween(params: { from: Date; to: Date }): Promise<TeacherOccupancy[]> {
    return this.uow.read(async () => this.occupancyQuery(params));
  }

  private async occupancyQuery(params: { from: Date; to: Date }): Promise<TeacherOccupancy[]> {
    const weeks = Math.max(
      (params.to.getTime() - params.from.getTime()) / (7 * 24 * 3_600_000),
      1 / 7,
    );

    const rows = await this.drizzle.db.execute<{
      teacher_id: string;
      teacher_name: string;
      scheduled_minutes: number;
      contracted_hours_week: number;
      session_count: number;
    }>(sql`
      SELECT
        tp.id                        AS teacher_id,
        u.name                       AS teacher_name,
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (s.scheduled_end - s.scheduled_start)) / 60
        ) FILTER (
          WHERE s.status IN ('scheduled', 'in_progress', 'completed')
        ), 0)::float                 AS scheduled_minutes,
        tp.contracted_hours_week::int AS contracted_hours_week,
        COUNT(s.id) FILTER (
          WHERE s.status IN ('scheduled', 'in_progress', 'completed')
        )::int                       AS session_count
      FROM teacher_profiles tp
      JOIN memberships m ON m.id = tp.membership_id
      JOIN users u       ON u.id = m.user_id
      LEFT JOIN sessions s
        ON s.teacher_profile_id = tp.id
       AND s.scheduled_start >= ${params.from.toISOString()}::timestamptz
       AND s.scheduled_start <  ${params.to.toISOString()}::timestamptz
      WHERE tp.status = 'active'
      GROUP BY tp.id, u.name, tp.contracted_hours_week
    `);

    return rows.map((r) => {
      const scheduledHours = Number(r.scheduled_minutes) / 60;
      const contractedHours = Number(r.contracted_hours_week) * weeks;
      return {
        teacherId: r.teacher_id,
        teacherName: r.teacher_name,
        scheduledHours: Math.round(scheduledHours * 100) / 100,
        contractedHours: Math.round(contractedHours * 100) / 100,
        occupancyRate:
          contractedHours > 0 ? Math.round((scheduledHours / contractedHours) * 1000) / 1000 : 0,
        sessionCount: Number(r.session_count),
      };
    });
  }

  /**
   * Padrón de un grupo, con nombre. Mismo cruce que ya hace
   * `DrizzleGroupEnrollmentRepository` (`enrollments` → `student_profiles`)
   * más `memberships`/`users` para el nombre — igual que `agendaQuery` ya
   * cruza `teacher_profiles`/`memberships`/`users` para `teacherName`.
   */
  async rosterForGroup(groupId: string): Promise<GroupRosterMember[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ student_id: string; name: string }>(sql`
        SELECT sp.id AS student_id, u.name AS name
        FROM enrollments e
        JOIN student_profiles sp ON sp.id = e.student_profile_id
        JOIN memberships m       ON m.id = sp.membership_id
        JOIN users u             ON u.id = m.user_id
        WHERE e.group_id = ${groupId} AND e.status = 'active'
        ORDER BY u.name
      `);
      return rows.map((r) => ({ studentId: r.student_id, name: r.name }));
    });
  }
}
