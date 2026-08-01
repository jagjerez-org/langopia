import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  LeadFunnelItem,
  PeopleReadModel,
  StudentListItem,
  TeacherListItem,
} from "../../application/ports/people-read-model.port.js";

/**
 * Lado de lectura. Igual que `DrizzleSchedulingReadModel`: SQL a mano, cruza
 * `student_profiles` con `memberships` y `users` para traer el nombre y el
 * correo, y devuelve estructuras planas. El aislamiento lo sigue dando RLS,
 * aunque la consulta toque tablas de otro contexto.
 */
@Injectable()
export class DrizzlePeopleReadModel implements PeopleReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async listStudents(): Promise<StudentListItem[]> {
    return this.uow.read(async () => this.query());
  }

  async findStudentIdByEmail(email: string): Promise<string | null> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ student_id: string }>(sql`
        SELECT sp.id AS student_id
        FROM student_profiles sp
        JOIN memberships m ON m.id = sp.membership_id
        JOIN users u       ON u.id = m.user_id
        WHERE lower(u.email) = lower(${email})
        LIMIT 1
      `);
      return rows[0]?.student_id ?? null;
    });
  }

  private async query(): Promise<StudentListItem[]> {
    const rows = await this.drizzle.db.execute<{
      student_id: string;
      membership_id: string;
      name: string;
      email: string;
      status: string;
      date_of_birth: string;
      guardian_required: boolean;
      native_language: string;
      target_language: string;
      current_level: string | null;
      joined_at: Date;
    }>(sql`
      SELECT
        sp.id                    AS student_id,
        m.id                     AS membership_id,
        u.name                   AS name,
        u.email                  AS email,
        sp.status::text          AS status,
        sp.date_of_birth::text   AS date_of_birth,
        sp.guardian_required     AS guardian_required,
        sp.native_language       AS native_language,
        sp.target_language       AS target_language,
        sp.current_level::text   AS current_level,
        sp.joined_at             AS joined_at
      FROM student_profiles sp
      JOIN memberships m ON m.id = sp.membership_id
      JOIN users u       ON u.id = m.user_id
      ORDER BY u.name
    `);

    return rows.map((r) => ({
      studentId: r.student_id,
      membershipId: r.membership_id,
      name: r.name,
      email: r.email,
      status: r.status,
      dateOfBirth: r.date_of_birth,
      guardianRequired: r.guardian_required,
      nativeLanguage: r.native_language,
      targetLanguage: r.target_language,
      currentLevel: r.current_level,
      joinedAt: new Date(r.joined_at).toISOString(),
    }));
  }

  async listTeachers(): Promise<TeacherListItem[]> {
    return this.uow.read(async () => this.teachersQuery());
  }

  async listLeads(): Promise<LeadFunnelItem[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        status: string;
        interested_language: string | null;
        declared_level: string | null;
        placement_level: string | null;
        placement_score: number | null;
        source_page: string | null;
        source_campaign: string | null;
        created_at: Date;
        last_contacted_at: Date | null;
      }>(sql`
        SELECT
          id,
          name,
          email,
          phone,
          status::text AS status,
          interested_language,
          declared_level::text AS declared_level,
          placement_level::text AS placement_level,
          placement_score,
          source_page,
          source_campaign,
          created_at,
          last_contacted_at
        FROM leads
        ORDER BY created_at DESC
      `);

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        interestedLanguage: row.interested_language,
        declaredLevel: row.declared_level,
        placementLevel: row.placement_level,
        placementScore: row.placement_score,
        sourcePage: row.source_page,
        sourceCampaign: row.source_campaign,
        createdAt: new Date(row.created_at).toISOString(),
        lastContactedAt: row.last_contacted_at ? new Date(row.last_contacted_at).toISOString() : null,
      }));
    });
  }

  /**
   * Dos consultas en la misma transacción (misma `uow.read`, así que el
   * mismo `app.school_id`): la ficha y la disponibilidad, ensambladas aquí en
   * vez de un `LEFT JOIN` con `json_agg` — un profesor tiene, como mucho, un
   * puñado de franjas, y así cada fila queda plana y fácil de tipar.
   */
  private async teachersQuery(): Promise<TeacherListItem[]> {
    const teacherRows = await this.drizzle.db.execute<{
      teacher_id: string;
      membership_id: string;
      name: string;
      email: string;
      tier: string;
      hourly_rate_cents: number;
      currency: string;
      contracted_hours_week: number;
      status: string;
      bio: string | null;
      languages: string[];
      certifications: string[];
      is_native_speaker: boolean;
      hired_at: string;
      left_reason: string | null;
    }>(sql`
      SELECT
        tp.id                     AS teacher_id,
        m.id                      AS membership_id,
        u.name                    AS name,
        u.email                   AS email,
        tp.tier::text             AS tier,
        tp.hourly_rate_cents      AS hourly_rate_cents,
        tp.currency               AS currency,
        tp.contracted_hours_week  AS contracted_hours_week,
        tp.status::text           AS status,
        tp.bio                    AS bio,
        tp.languages              AS languages,
        tp.certifications         AS certifications,
        tp.is_native_speaker      AS is_native_speaker,
        tp.hired_at::text         AS hired_at,
        tp.left_reason            AS left_reason
      FROM teacher_profiles tp
      JOIN memberships m ON m.id = tp.membership_id
      JOIN users u       ON u.id = m.user_id
      ORDER BY u.name
    `);

    const availabilityRows = await this.drizzle.db.execute<{
      teacher_profile_id: string;
      weekday: number;
      start_minute: number;
      end_minute: number;
    }>(sql`
      SELECT teacher_profile_id, weekday, start_minute, end_minute
      FROM teacher_availability
      ORDER BY teacher_profile_id, weekday, start_minute
    `);

    const availabilityByTeacher = new Map<
      string,
      { weekday: number; startMinute: number; endMinute: number }[]
    >();
    for (const row of availabilityRows) {
      const slots = availabilityByTeacher.get(row.teacher_profile_id) ?? [];
      slots.push({ weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute });
      availabilityByTeacher.set(row.teacher_profile_id, slots);
    }

    return teacherRows.map((r) => ({
      teacherId: r.teacher_id,
      membershipId: r.membership_id,
      name: r.name,
      email: r.email,
      tier: r.tier,
      hourlyRateCents: r.hourly_rate_cents,
      currency: r.currency,
      contractedHoursWeek: r.contracted_hours_week,
      status: r.status,
      bio: r.bio,
      languages: r.languages,
      certifications: r.certifications,
      isNativeSpeaker: r.is_native_speaker,
      hiredAt: r.hired_at,
      leftReason: r.left_reason,
      availability: availabilityByTeacher.get(r.teacher_id) ?? [],
    }));
  }
}
