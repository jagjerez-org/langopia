import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  AtRiskStudent,
  DashboardCoreMetrics,
  PortalAttendanceEntry,
  PortalInvoiceEntry,
  PortalReadModel,
  PortalSessionEntry,
  PortalStudentOption,
  StudentAccess,
} from "../../application/ports/portal-read-model.port.js";

/** `YYYY-MM-DD`, lo que espera una columna `date` interpolada en SQL crudo. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Lado de lectura del portal.
 *
 * SQL a mano, igual que `DrizzleSchedulingReadModel`: cruza tablas de
 * `people`, `scheduling`, `billing` y `evaluations` (todavía sin contexto
 * propio) sin pasar por el dominio de ninguna. El aislamiento entre escuelas
 * lo sigue dando RLS —esta clase no filtra por `school_id` en ningún
 * `WHERE`—; lo que SÍ decide cada consulta es DE QUIÉN, dentro de la misma
 * escuela, son los datos (`ownStudentId`, `studentAccess`): eso no lo cubre
 * RLS, que aísla escuelas, no personas dentro de una escuela.
 */
@Injectable()
export class DrizzlePortalReadModel implements PortalReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async studentsAtRisk(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    now: Date;
  }): Promise<Array<Omit<AtRiskStudent, "reasons">>> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        student_id: string;
        name: string;
        total: number | null;
        attended: number | null;
        last_evaluation_at: Date | null;
      }>(sql`
        WITH recent_attendance AS (
          SELECT a.student_profile_id,
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended
          FROM attendance a
          JOIN sessions s ON s.id = a.session_id
          WHERE s.scheduled_start >= ${params.attendanceFrom.toISOString()}::timestamptz
            AND s.scheduled_start <  ${params.attendanceTo.toISOString()}::timestamptz
          GROUP BY a.student_profile_id
        ),
        last_evaluation AS (
          SELECT student_profile_id, MAX(created_at) AS last_at
          FROM evaluations
          GROUP BY student_profile_id
        )
        SELECT
          sp.id      AS student_id,
          u.name     AS name,
          ra.total,
          ra.attended,
          le.last_at AS last_evaluation_at
        FROM student_profiles sp
        JOIN memberships m ON m.id = sp.membership_id
        JOIN users u       ON u.id = m.user_id
        LEFT JOIN recent_attendance ra ON ra.student_profile_id = sp.id
        LEFT JOIN last_evaluation le   ON le.student_profile_id = sp.id
        WHERE sp.status = 'active'
        ORDER BY u.name
      `);

      return rows.map((r) => {
        const total = Number(r.total ?? 0);
        const attended = Number(r.attended ?? 0);
        const attendanceRate = total > 0 ? Math.round((attended / total) * 1000) / 1000 : null;
        const weeksSinceLastEvaluation = r.last_evaluation_at
          ? Math.floor(
              (params.now.getTime() - new Date(r.last_evaluation_at).getTime()) /
                (7 * 24 * 3_600_000),
            )
          : null;

        return {
          studentId: r.student_id,
          name: r.name,
          attendanceRate,
          weeksSinceLastEvaluation,
        };
      });
    });
  }

  async coreMetrics(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    invoicedFrom: Date;
    invoicedTo: Date;
  }): Promise<DashboardCoreMetrics> {
    return this.uow.read(async () => {
      const [activeRows, attendanceRows, invoicedRows] = await Promise.all([
        this.drizzle.db.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM student_profiles WHERE status = 'active'
        `),
        this.drizzle.db.execute<{ total: number; attended: number }>(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended
          FROM attendance a
          JOIN sessions s ON s.id = a.session_id
          WHERE s.scheduled_start >= ${params.attendanceFrom.toISOString()}::timestamptz
            AND s.scheduled_start <  ${params.attendanceTo.toISOString()}::timestamptz
        `),
        this.drizzle.db.execute<{ amount_cents: number; currency: string }>(sql`
          SELECT
            COALESCE(SUM(i.total_cents), 0)::int AS amount_cents,
            (SELECT currency FROM schools LIMIT 1) AS currency
          FROM invoices i
          WHERE i.direction = 'school_to_student'
            AND i.issued_on IS NOT NULL
            AND i.issued_on >= ${isoDate(params.invoicedFrom)}::date
            AND i.issued_on <  ${isoDate(params.invoicedTo)}::date
        `),
      ]);

      const total = Number(attendanceRows[0]?.total ?? 0);
      const attended = Number(attendanceRows[0]?.attended ?? 0);

      return {
        activeStudents: Number(activeRows[0]?.count ?? 0),
        averageAttendanceRate: total > 0 ? Math.round((attended / total) * 1000) / 1000 : 0,
        invoicedThisMonthCents: Number(invoicedRows[0]?.amount_cents ?? 0),
        currency: invoicedRows[0]?.currency ?? "EUR",
      };
    });
  }

  async ownStudentId(membershipId: string): Promise<string | null> {
    return this.uow.read(async () => {
      const self = await this.drizzle.db.execute<{ id: string }>(sql`
        SELECT id FROM student_profiles WHERE membership_id = ${membershipId} LIMIT 1
      `);
      const own = self[0];
      if (own) return own.id;

      const guarded = await this.drizzle.db.execute<{ student_profile_id: string }>(sql`
        SELECT student_profile_id FROM guardians
        WHERE membership_id = ${membershipId}
        ORDER BY created_at
        LIMIT 1
      `);
      return guarded[0]?.student_profile_id ?? null;
    });
  }

  async studentAccess(studentId: string, membershipId: string): Promise<StudentAccess> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        membership_id: string;
        is_guardian: boolean;
      }>(sql`
        SELECT
          sp.membership_id,
          EXISTS(
            SELECT 1 FROM guardians g
            WHERE g.student_profile_id = sp.id AND g.membership_id = ${membershipId}
          ) AS is_guardian
        FROM student_profiles sp
        WHERE sp.id = ${studentId}
      `);
      const row = rows[0];
      if (!row) return { kind: "not_found" };
      if (row.membership_id === membershipId || row.is_guardian) {
        return { kind: "allowed", studentId };
      }
      return { kind: "denied" };
    });
  }

  async myStudents(membershipId: string): Promise<PortalStudentOption[]> {
    return this.uow.read(async () => {
      const self = await this.drizzle.db.execute<{ student_id: string; name: string }>(sql`
        SELECT sp.id AS student_id, u.name
        FROM student_profiles sp
        JOIN memberships m ON m.id = sp.membership_id
        JOIN users u       ON u.id = m.user_id
        WHERE sp.membership_id = ${membershipId}
      `);
      if (self[0]) return [{ studentId: self[0].student_id, name: self[0].name }];

      const wards = await this.drizzle.db.execute<{ student_id: string; name: string }>(sql`
        SELECT sp.id AS student_id, u.name
        FROM guardians g
        JOIN student_profiles sp ON sp.id = g.student_profile_id
        JOIN memberships m       ON m.id = sp.membership_id
        JOIN users u             ON u.id = m.user_id
        WHERE g.membership_id = ${membershipId}
        ORDER BY g.created_at
      `);
      return wards.map((r) => ({ studentId: r.student_id, name: r.name }));
    });
  }

  async sessionsForStudent(studentId: string): Promise<PortalSessionEntry[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        session_id: string;
        group_name: string;
        course_code: string;
        teacher_name: string | null;
        start: Date;
        end: Date;
        status: string;
        room_provider: string;
        room_url: string | null;
        topic: string | null;
      }>(sql`
        SELECT
          s.id                  AS session_id,
          g.name                AS group_name,
          c.code                AS course_code,
          tu.name               AS teacher_name,
          s.scheduled_start     AS start,
          s.scheduled_end       AS "end",
          s.status::text        AS status,
          s.room_provider::text AS room_provider,
          s.room_url,
          s.topic
        FROM sessions s
        JOIN groups  g ON g.id = s.group_id
        JOIN courses c ON c.id = g.course_id
        JOIN enrollments e ON e.group_id = g.id AND e.student_profile_id = ${studentId}
        LEFT JOIN teacher_profiles tp ON tp.id = s.teacher_profile_id
        LEFT JOIN memberships tm      ON tm.id = tp.membership_id
        LEFT JOIN users tu            ON tu.id = tm.user_id
        ORDER BY s.scheduled_start DESC
      `);

      return rows.map((r) => ({
        sessionId: r.session_id,
        groupName: r.group_name,
        courseCode: r.course_code,
        teacherName: r.teacher_name,
        start: new Date(r.start).toISOString(),
        end: new Date(r.end).toISOString(),
        status: r.status,
        roomProvider: r.room_provider,
        roomUrl: r.room_url,
        topic: r.topic,
      }));
    });
  }

  async attendanceForStudent(studentId: string): Promise<PortalAttendanceEntry[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        session_id: string;
        group_name: string;
        start: Date;
        status: string;
      }>(sql`
        SELECT a.session_id, g.name AS group_name, s.scheduled_start AS start, a.status::text AS status
        FROM attendance a
        JOIN sessions s ON s.id = a.session_id
        JOIN groups g   ON g.id = s.group_id
        WHERE a.student_profile_id = ${studentId}
        ORDER BY s.scheduled_start DESC
      `);

      return rows.map((r) => ({
        sessionId: r.session_id,
        groupName: r.group_name,
        start: new Date(r.start).toISOString(),
        status: r.status,
      }));
    });
  }

  async invoicesForStudent(studentId: string): Promise<PortalInvoiceEntry[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        invoice_id: string;
        number: string;
        status: string;
        total_cents: number;
        currency: string;
        issued_on: Date | null;
        due_on: Date | null;
        paid_at: Date | null;
      }>(sql`
        SELECT
          id AS invoice_id, number, status::text AS status, total_cents, currency,
          issued_on, due_on, paid_at
        FROM invoices
        WHERE student_profile_id = ${studentId}
          AND direction = 'school_to_student'
        ORDER BY created_at DESC
      `);

      return rows.map((r) => ({
        invoiceId: r.invoice_id,
        number: r.number,
        status: r.status,
        totalCents: Number(r.total_cents),
        currency: r.currency,
        issuedOn: r.issued_on ? isoDate(new Date(r.issued_on)) : null,
        dueOn: r.due_on ? isoDate(new Date(r.due_on)) : null,
        paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      }));
    });
  }
}
