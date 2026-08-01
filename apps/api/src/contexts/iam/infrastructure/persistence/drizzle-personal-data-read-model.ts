import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { PersonAccessContext } from "../../domain/model/personal-data-access.js";
import type {
  AssessmentEntry,
  AttemptEntry,
  AttendanceEntry,
  ConsentEntry,
  EnrollmentEntry,
  EvaluationEntry,
  GuardianOfPerson,
  InvoiceEntry,
  PersonRole,
  PersonalDataExport,
  PersonalDataReadModel,
  StudentProfileSection,
  TeacherProfileSection,
  TranscriptEntry,
  WardOfGuardian,
} from "../../application/ports/personal-data-read-model.port.js";

type BaseProfileRow = {
  membership_id: string;
  role: PersonRole;
  membership_status: string;
  joined_at: Date;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  created_at: Date;
  last_seen_at: Date | null;
  student_profile_id: string | null;
  date_of_birth: string | null;
  guardian_required: boolean | null;
  native_language: string | null;
  target_language: string | null;
  current_level: string | null;
  target_level: string | null;
  goals: string | null;
  student_status: string | null;
  student_joined_at: Date | null;
  paused_until: string | null;
  student_left_at: Date | null;
  student_left_reason: string | null;
  teacher_profile_id: string | null;
  tier: string | null;
  languages: string[] | null;
  is_native_speaker: boolean | null;
  hourly_rate_cents: number | null;
  currency: string | null;
  contracted_hours_week: number | null;
  teacher_status: string | null;
  hired_at: string | null;
  teacher_left_at: Date | null;
  teacher_left_reason: string | null;
};

/**
 * Modelo de lectura del derecho de acceso y portabilidad.
 *
 * Igual que `DrizzlePortalReadModel`: SQL a mano, cruza tablas de `people`,
 * `catalog`, `scheduling`, `assessment`, `billing` y `classroom` sin cargar
 * ningún agregado. RLS sigue siendo quien aísla entre escuelas; esta clase
 * decide QUÉ leer, nunca DE QUIÉN es cada fila (eso lo hace
 * `canAccessPersonalData`, antes de llegar aquí).
 */
@Injectable()
export class DrizzlePersonalDataReadModel implements PersonalDataReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async accessContext(membershipId: string): Promise<PersonAccessContext | null> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        membership_id: string;
        student_profile_id: string | null;
        is_minor: boolean;
      }>(sql`
        SELECT m.id AS membership_id, sp.id AS student_profile_id,
               COALESCE(sp.guardian_required, false) AS is_minor
        FROM memberships m
        LEFT JOIN student_profiles sp ON sp.membership_id = m.id
        WHERE m.id = ${membershipId}
        LIMIT 1
      `);
      const row = rows[0];
      if (!row) return null;

      let guardianMembershipIds: string[] = [];
      if (row.is_minor && row.student_profile_id) {
        const guardians = await this.drizzle.db.execute<{ membership_id: string }>(sql`
          SELECT membership_id FROM guardians WHERE student_profile_id = ${row.student_profile_id}
        `);
        guardianMembershipIds = guardians.map((g) => g.membership_id);
      }

      return { membershipId: row.membership_id, isMinor: row.is_minor, guardianMembershipIds };
    });
  }

  async exportFor(membershipId: string): Promise<PersonalDataExport> {
    return this.uow.read(async () => this.assembleExport(membershipId));
  }

  private async assembleExport(membershipId: string): Promise<PersonalDataExport> {
    const baseRows = await this.drizzle.db.execute<BaseProfileRow>(sql`
      SELECT
        m.id AS membership_id, m.role::text AS role, m.status::text AS membership_status, m.joined_at,
        u.name, u.email, u.locale, u.timezone, u.created_at, u.last_seen_at,
        sp.id AS student_profile_id, sp.date_of_birth::text AS date_of_birth, sp.guardian_required,
        sp.native_language, sp.target_language, sp.current_level::text AS current_level,
        sp.target_level::text AS target_level, sp.goals, sp.status::text AS student_status,
        sp.joined_at AS student_joined_at, sp.paused_until::text AS paused_until,
        sp.left_at AS student_left_at, sp.left_reason AS student_left_reason,
        tp.id AS teacher_profile_id, tp.tier::text AS tier, tp.languages, tp.is_native_speaker,
        tp.hourly_rate_cents, tp.currency, tp.contracted_hours_week, tp.status::text AS teacher_status,
        tp.hired_at::text AS hired_at, tp.left_at AS teacher_left_at, tp.left_reason AS teacher_left_reason
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN student_profiles sp ON sp.membership_id = m.id
      LEFT JOIN teacher_profiles tp ON tp.membership_id = m.id
      WHERE m.id = ${membershipId}
      LIMIT 1
    `);
    const base = baseRows[0];
    if (!base) {
      throw new Error(
        `exportFor(${membershipId}): la membresía no existe. El manejador debe comprobar accessContext() antes.`,
      );
    }

    const studentProfileId = base.student_profile_id;
    const teacherProfileId = base.teacher_profile_id;

    const [
      guardians,
      wardsAsGuardian,
      consents,
      enrollments,
      attendance,
      attempts,
      assessments,
      evaluationsAsStudent,
      evaluationsAsTeacher,
      invoices,
      transcripts,
    ] = await Promise.all([
      studentProfileId ? this.guardiansOf(studentProfileId) : Promise.resolve([]),
      this.wardsOf(membershipId),
      this.consentsOf(membershipId),
      studentProfileId ? this.enrollmentsOf(studentProfileId) : Promise.resolve([]),
      studentProfileId ? this.attendanceOf(studentProfileId) : Promise.resolve([]),
      studentProfileId ? this.attemptsOf(studentProfileId) : Promise.resolve([]),
      studentProfileId ? this.assessmentsOf(studentProfileId) : Promise.resolve([]),
      studentProfileId ? this.evaluationsAsStudent(studentProfileId) : Promise.resolve([]),
      teacherProfileId ? this.evaluationsAsTeacher(teacherProfileId) : Promise.resolve([]),
      this.invoicesOf({ membershipId, studentProfileId }),
      this.transcriptsOf({ membershipId, studentProfileId, teacherProfileId }),
    ]);

    const student: StudentProfileSection | null = studentProfileId
      ? {
          studentProfileId,
          dateOfBirth: base.date_of_birth!,
          isMinor: base.guardian_required ?? false,
          nativeLanguage: base.native_language!,
          targetLanguage: base.target_language!,
          currentLevel: base.current_level,
          targetLevel: base.target_level,
          goals: base.goals,
          status: base.student_status!,
          joinedAt: new Date(base.student_joined_at!).toISOString(),
          pausedUntil: base.paused_until,
          leftAt: base.student_left_at ? new Date(base.student_left_at).toISOString() : null,
          leftReason: base.student_left_reason,
          guardians,
        }
      : null;

    const teacher: TeacherProfileSection | null = teacherProfileId
      ? {
          teacherProfileId,
          tier: base.tier!,
          languages: base.languages ?? [],
          isNativeSpeaker: base.is_native_speaker ?? false,
          hourlyRateCents: base.hourly_rate_cents ?? 0,
          currency: base.currency ?? "EUR",
          contractedHoursWeek: base.contracted_hours_week ?? 0,
          status: base.teacher_status!,
          hiredAt: base.hired_at!,
          leftAt: base.teacher_left_at ? new Date(base.teacher_left_at).toISOString() : null,
          leftReason: base.teacher_left_reason,
        }
      : null;

    return {
      membershipId: base.membership_id,
      name: base.name,
      email: base.email,
      role: base.role,
      membershipStatus: base.membership_status,
      locale: base.locale,
      timezone: base.timezone,
      createdAt: new Date(base.created_at).toISOString(),
      lastSeenAt: base.last_seen_at ? new Date(base.last_seen_at).toISOString() : null,
      joinedAt: new Date(base.joined_at).toISOString(),
      student,
      teacher,
      wardsAsGuardian,
      consents,
      enrollments,
      attendance,
      attempts,
      assessments,
      evaluations: [...evaluationsAsStudent, ...evaluationsAsTeacher],
      invoices,
      transcripts,
    };
  }

  private async guardiansOf(studentProfileId: string): Promise<GuardianOfPerson[]> {
    const rows = await this.drizzle.db.execute<{
      membership_id: string;
      name: string;
      relationship: string;
      can_give_consent: boolean;
    }>(sql`
      SELECT g.membership_id, gu.name, g.relationship::text, g.can_give_consent
      FROM guardians g
      JOIN memberships gm ON gm.id = g.membership_id
      JOIN users gu ON gu.id = gm.user_id
      WHERE g.student_profile_id = ${studentProfileId}
    `);
    return rows.map((r) => ({
      membershipId: r.membership_id,
      name: r.name,
      relationship: r.relationship,
      canGiveConsent: r.can_give_consent,
    }));
  }

  private async wardsOf(membershipId: string): Promise<WardOfGuardian[]> {
    const rows = await this.drizzle.db.execute<{
      student_membership_id: string;
      student_name: string;
      relationship: string;
      can_give_consent: boolean;
    }>(sql`
      SELECT sm.id AS student_membership_id, su.name AS student_name,
             g.relationship::text, g.can_give_consent
      FROM guardians g
      JOIN student_profiles sp2 ON sp2.id = g.student_profile_id
      JOIN memberships sm ON sm.id = sp2.membership_id
      JOIN users su ON su.id = sm.user_id
      WHERE g.membership_id = ${membershipId}
    `);
    return rows.map((r) => ({
      studentMembershipId: r.student_membership_id,
      studentName: r.student_name,
      relationship: r.relationship,
      canGiveConsent: r.can_give_consent,
    }));
  }

  private async consentsOf(membershipId: string): Promise<ConsentEntry[]> {
    const rows = await this.drizzle.db.execute<{
      kind: string;
      status: string;
      granted_by_membership_id: string | null;
      granted_at: Date | null;
      withdrawn_at: Date | null;
      policy_version: string;
    }>(sql`
      SELECT kind::text, status::text, granted_by_membership_id, granted_at, withdrawn_at, policy_version
      FROM consents
      WHERE subject_membership_id = ${membershipId}
      ORDER BY created_at
    `);
    return rows.map((r) => ({
      kind: r.kind,
      status: r.status,
      grantedByMembershipId: r.granted_by_membership_id,
      grantedAt: r.granted_at ? new Date(r.granted_at).toISOString() : null,
      withdrawnAt: r.withdrawn_at ? new Date(r.withdrawn_at).toISOString() : null,
      policyVersion: r.policy_version,
    }));
  }

  private async enrollmentsOf(studentProfileId: string): Promise<EnrollmentEntry[]> {
    const rows = await this.drizzle.db.execute<{
      id: string;
      course_code: string;
      group_name: string;
      status: string;
      enrolled_at: Date;
      ended_at: Date | null;
    }>(sql`
      SELECT en.id, c.code AS course_code, g.name AS group_name, en.status::text,
             en.enrolled_at, en.ended_at
      FROM enrollments en
      JOIN groups g ON g.id = en.group_id
      JOIN courses c ON c.id = g.course_id
      WHERE en.student_profile_id = ${studentProfileId}
      ORDER BY en.enrolled_at DESC
    `);
    return rows.map((r) => ({
      enrollmentId: r.id,
      courseCode: r.course_code,
      groupName: r.group_name,
      status: r.status,
      enrolledAt: new Date(r.enrolled_at).toISOString(),
      endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    }));
  }

  private async attendanceOf(studentProfileId: string): Promise<AttendanceEntry[]> {
    const rows = await this.drizzle.db.execute<{
      session_id: string;
      group_name: string;
      scheduled_start: Date;
      status: string;
      source: string;
      minutes_present: number | null;
    }>(sql`
      SELECT a.session_id, g.name AS group_name, s.scheduled_start, a.status::text,
             a.source::text, a.minutes_present
      FROM attendance a
      JOIN sessions s ON s.id = a.session_id
      JOIN groups g ON g.id = s.group_id
      WHERE a.student_profile_id = ${studentProfileId}
      ORDER BY s.scheduled_start DESC
    `);
    return rows.map((r) => ({
      sessionId: r.session_id,
      groupName: r.group_name,
      scheduledStart: new Date(r.scheduled_start).toISOString(),
      status: r.status,
      source: r.source,
      minutesPresent: r.minutes_present,
    }));
  }

  private async attemptsOf(studentProfileId: string): Promise<AttemptEntry[]> {
    const rows = await this.drizzle.db.execute<{
      id: string;
      exercise_id: string;
      attempt_number: number;
      status: string;
      ai_score: number | null;
      teacher_score: number | null;
      submitted_at: Date;
    }>(sql`
      SELECT id, exercise_id, attempt_number, status::text, ai_score, teacher_score, submitted_at
      FROM attempts
      WHERE student_profile_id = ${studentProfileId}
      ORDER BY submitted_at DESC
    `);
    return rows.map((r) => ({
      attemptId: r.id,
      exerciseId: r.exercise_id,
      attemptNumber: r.attempt_number,
      status: r.status,
      aiScore: r.ai_score,
      teacherScore: r.teacher_score,
      submittedAt: new Date(r.submitted_at).toISOString(),
    }));
  }

  private async assessmentsOf(studentProfileId: string): Promise<AssessmentEntry[]> {
    const rows = await this.drizzle.db.execute<{
      id: string;
      kind: string;
      title: string;
      status: string;
      level_before: string | null;
      level_result: string | null;
      score: number | null;
      max_score: number | null;
      scheduled_for: Date | null;
    }>(sql`
      SELECT id, kind::text, title, status::text, level_before::text, level_result::text,
             score, max_score, scheduled_for
      FROM assessments
      WHERE student_profile_id = ${studentProfileId}
      ORDER BY created_at DESC
    `);
    return rows.map((r) => ({
      assessmentId: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      levelBefore: r.level_before,
      levelResult: r.level_result,
      score: r.score,
      maxScore: r.max_score,
      scheduledFor: r.scheduled_for ? new Date(r.scheduled_for).toISOString() : null,
    }));
  }

  private async evaluationsAsStudent(studentProfileId: string): Promise<EvaluationEntry[]> {
    const rows = await this.drizzle.db.execute<EvaluationRow>(sql`
      SELECT e.id, e.period_start::text AS period_start, e.period_end::text AS period_end,
             e.progress_rating, e.strengths, e.improvements, e.next_steps, e.created_at,
             tu.name AS counterpart_name
      FROM evaluations e
      JOIN teacher_profiles tp ON tp.id = e.teacher_profile_id
      JOIN memberships tm ON tm.id = tp.membership_id
      JOIN users tu ON tu.id = tm.user_id
      WHERE e.student_profile_id = ${studentProfileId}
      ORDER BY e.created_at DESC
    `);
    return rows.map((r) => toEvaluationEntry(r, "student"));
  }

  private async evaluationsAsTeacher(teacherProfileId: string): Promise<EvaluationEntry[]> {
    const rows = await this.drizzle.db.execute<EvaluationRow>(sql`
      SELECT e.id, e.period_start::text AS period_start, e.period_end::text AS period_end,
             e.progress_rating, e.strengths, e.improvements, e.next_steps, e.created_at,
             su.name AS counterpart_name
      FROM evaluations e
      JOIN student_profiles sp2 ON sp2.id = e.student_profile_id
      JOIN memberships sm ON sm.id = sp2.membership_id
      JOIN users su ON su.id = sm.user_id
      WHERE e.teacher_profile_id = ${teacherProfileId}
      ORDER BY e.created_at DESC
    `);
    return rows.map((r) => toEvaluationEntry(r, "teacher"));
  }

  private async invoicesOf(params: {
    membershipId: string;
    studentProfileId: string | null;
  }): Promise<InvoiceEntry[]> {
    const rows = await this.drizzle.db.execute<{
      id: string;
      number: string;
      direction: string;
      status: string;
      currency: string;
      total_cents: number;
      issued_on: string | null;
      due_on: string | null;
      paid_at: Date | null;
    }>(sql`
      SELECT id, number, direction::text, status::text, currency, total_cents,
             issued_on::text AS issued_on, due_on::text AS due_on, paid_at
      FROM invoices
      WHERE bill_to_membership_id = ${params.membershipId}
         OR student_profile_id = ${params.studentProfileId}
      ORDER BY created_at DESC
    `);
    return rows.map((r) => ({
      invoiceId: r.id,
      number: r.number,
      direction: r.direction,
      status: r.status,
      currency: r.currency,
      totalCents: Number(r.total_cents),
      issuedOn: r.issued_on,
      dueOn: r.due_on,
      paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
    }));
  }

  /**
   * Transcripciones «donde aparece» (brief, verbatim): como alumno que
   * asistió a la sesión, o como profesor que la impartió — la UNION cubre
   * los dos casos con una sola consulta, sin duplicar filas por transcripción.
   * Los segmentos propios se traen aparte y se acoplan en memoria: son la
   * MISMA fila (`speaker_membership_id = membershipId`) sin importar si la
   * transcripción salió por la vía del alumno o la del profesor.
   */
  private async transcriptsOf(params: {
    membershipId: string;
    studentProfileId: string | null;
    teacherProfileId: string | null;
  }): Promise<TranscriptEntry[]> {
    const candidates = await this.drizzle.db.execute<{
      id: string;
      session_id: string;
      status: string;
      language: string;
      has_recording: boolean;
    }>(sql`
      SELECT t.id, t.session_id, t.status::text, t.language, (t.recording_storage_key IS NOT NULL) AS has_recording
      FROM transcripts t
      JOIN sessions s ON s.id = t.session_id
      JOIN attendance a ON a.session_id = s.id AND a.student_profile_id = ${params.studentProfileId}

      UNION

      SELECT t.id, t.session_id, t.status::text, t.language, (t.recording_storage_key IS NOT NULL) AS has_recording
      FROM transcripts t
      JOIN sessions s ON s.id = t.session_id
      WHERE s.teacher_profile_id = ${params.teacherProfileId}
    `);
    if (candidates.length === 0) return [];

    const segments = await this.drizzle.db.execute<{
      transcript_id: string;
      start_ms: number;
      end_ms: number;
      text: string;
    }>(sql`
      SELECT transcript_id, start_ms, end_ms, text
      FROM transcript_segments
      WHERE speaker_membership_id = ${params.membershipId}
      ORDER BY transcript_id, start_ms
    `);

    const segmentsByTranscript = new Map<string, Array<{ startMs: number; endMs: number; text: string }>>();
    for (const seg of segments) {
      const list = segmentsByTranscript.get(seg.transcript_id) ?? [];
      list.push({ startMs: seg.start_ms, endMs: seg.end_ms, text: seg.text });
      segmentsByTranscript.set(seg.transcript_id, list);
    }

    return candidates.map((c) => {
      const ownSegments = segmentsByTranscript.get(c.id) ?? [];
      return {
        transcriptId: c.id,
        sessionId: c.session_id,
        status: c.status,
        language: c.language,
        spokeInSession: ownSegments.length > 0,
        hasRecording: c.has_recording,
        ownSegments,
      };
    });
  }
}

type EvaluationRow = {
  id: string;
  period_start: string;
  period_end: string;
  progress_rating: number;
  strengths: string | null;
  improvements: string | null;
  next_steps: string | null;
  created_at: Date;
  counterpart_name: string;
};

function toEvaluationEntry(row: EvaluationRow, as: "student" | "teacher"): EvaluationEntry {
  return {
    evaluationId: row.id,
    as,
    counterpartName: row.counterpart_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    progressRating: row.progress_rating,
    strengths: row.strengths,
    improvements: row.improvements,
    nextSteps: row.next_steps,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
