import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, asc, eq, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { RoomProvider } from "../../domain/model/room-provider.js";
import type { ExternalTranscriptImportCandidate } from "../../domain/ports/transcript-repository.port.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import type {
  PurgeCandidate,
  RecordingConsentStatus,
  TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";
import {
  Transcript,
  TranscriptId,
  type TranscriptConsentParticipant,
} from "../../domain/model/transcript.aggregate.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Ninguna consulta filtra por `school_id` a mano: la conexión usa el rol
 * `langopia_app` y la unidad de trabajo fija `app.school_id`, así que las
 * políticas RLS filtran por debajo. Añadirlo aquí daría una falsa sensación
 * de seguridad.
 */
@Injectable()
export class DrizzleTranscriptRepository implements TranscriptRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findExpired(now: Date): Promise<PurgeCandidate[]> {
    const rows = await this.drizzle.db
      .select({
        id: schema.transcripts.id,
        retentionUntil: schema.transcripts.retentionUntil,
        recordingStorageKey: schema.transcripts.recordingStorageKey,
      })
      .from(schema.transcripts)
      .where(
        and(isNotNull(schema.transcripts.retentionUntil), lte(schema.transcripts.retentionUntil, now)),
      );
    return rows;
  }

  async findExternalCompletedWithoutTranscript(now: Date): Promise<ExternalTranscriptImportCandidate[]> {
    const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const rows = await this.drizzle.db
      .select({
        sessionId: schema.sessions.id,
        schoolId: schema.sessions.schoolId,
        provider: schema.sessions.roomProvider,
        externalId: schema.sessions.roomExternalId,
        scheduledEnd: schema.sessions.scheduledEnd,
      })
      .from(schema.sessions)
      .leftJoin(schema.transcripts, eq(schema.transcripts.sessionId, schema.sessions.id))
      .where(
        and(
          eq(schema.sessions.status, "completed"),
          ne(schema.sessions.roomProvider, RoomProvider.LiveKit),
          ne(schema.sessions.roomProvider, RoomProvider.InPerson),
          isNotNull(schema.sessions.roomExternalId),
          lte(schema.sessions.scheduledEnd, cutoff),
          isNull(schema.transcripts.id),
        ),
      );

    return rows
      .filter((row): row is typeof row & { externalId: string } => row.externalId !== null)
      .map((row) => ({
        sessionId: row.sessionId,
        schoolId: row.schoolId,
        provider: row.provider as ExternalTranscriptImportCandidate["provider"],
        externalId: row.externalId,
        scheduledEnd: row.scheduledEnd,
      }));
  }

  async delete(id: string): Promise<void> {
    await this.drizzle.db.delete(schema.transcripts).where(eq(schema.transcripts.id, id));
  }

  async recordingStatusForSession(sessionId: string): Promise<RecordingConsentStatus | null> {
    const [row] = await this.drizzle.db
      .select({ status: schema.transcripts.status, blockedReason: schema.transcripts.blockedReason })
      .from(schema.transcripts)
      .where(eq(schema.transcripts.sessionId, sessionId))
      .limit(1);
    if (!row) return null;
    return { blocked: row.status === "blocked_no_consent", blockedReason: row.blockedReason };
  }

  async findReadyById(id: string): Promise<Transcript | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(schema.transcripts)
      .where(and(eq(schema.transcripts.id, id), eq(schema.transcripts.status, "ready")))
      .limit(1);
    if (!row) return null;

    const segments = await this.drizzle.db
      .select()
      .from(schema.transcriptSegments)
      .where(eq(schema.transcriptSegments.transcriptId, id))
      .orderBy(asc(schema.transcriptSegments.startMs));

    const participantIds = [...new Set(segments.flatMap((segment) => (segment.speakerMembershipId ? [segment.speakerMembershipId] : [])))];

    return Transcript.rehydrate({
      id: TranscriptId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      sessionId: row.sessionId,
      provider: row.provider,
      language: row.language,
      status: row.status,
      durationMs: row.durationMs,
      summary: row.summary,
      vocabulary: row.vocabulary,
      blockedReason: row.blockedReason,
      recordingStorageKey: row.recordingStorageKey,
      retentionUntil: row.retentionUntil,
      readyAt: row.readyAt,
      participants: participantIds.map((membershipId) => MembershipId.of(membershipId)),
      segments: segments.map((segment) => ({
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        speakerMembershipId: segment.speakerMembershipId ? MembershipId.of(segment.speakerMembershipId) : null,
        speakerLabel: segment.speakerLabel,
        confidenceBps: segment.confidence,
        isTeacher: segment.isTeacher,
      })),
    });
  }

  async consentReadinessForSession(sessionId: string): Promise<{
    dataRetentionDays: number;
    participants: TranscriptConsentParticipant[];
  }> {
    const rows = await this.drizzle.db.execute<{
      membership_id: string;
      display_name: string;
      guardian_required: boolean;
      guardian_membership_id: string | null;
      consent_status: "granted" | "denied" | "withdrawn" | null;
      granted_by_membership_id: string | null;
      data_retention_days: number;
    }>(sql`
      WITH session_scope AS (
        SELECT s.id, s.school_id, s.group_id, s.teacher_profile_id, sc.data_retention_days
        FROM sessions s
        JOIN schools sc ON sc.id = s.school_id
        WHERE s.id = ${sessionId}
      ),
      participants AS (
        SELECT
          m.id AS membership_id,
          u.name AS display_name,
          p.guardian_required,
          signer.membership_id AS guardian_membership_id,
          c.status AS consent_status,
          c.granted_by_membership_id,
          ss.data_retention_days
        FROM session_scope ss
        JOIN enrollments e        ON e.group_id = ss.group_id AND e.status = 'active'
        JOIN student_profiles p   ON p.id = e.student_profile_id
        JOIN memberships m        ON m.id = p.membership_id
        JOIN users u              ON u.id = m.user_id
        LEFT JOIN LATERAL (
          SELECT g.membership_id
          FROM guardians g
          WHERE g.student_profile_id = p.id
            AND g.can_give_consent = true
          ORDER BY g.created_at ASC
          LIMIT 1
        ) signer ON true
        LEFT JOIN consents c
          ON c.subject_membership_id = p.membership_id
         AND c.kind = 'recording'

        UNION ALL

        SELECT
          m.id AS membership_id,
          u.name AS display_name,
          false AS guardian_required,
          NULL::uuid AS guardian_membership_id,
          c.status AS consent_status,
          c.granted_by_membership_id,
          ss.data_retention_days
        FROM session_scope ss
        JOIN teacher_profiles tp ON tp.id = ss.teacher_profile_id
        JOIN memberships m       ON m.id = tp.membership_id
        JOIN users u             ON u.id = m.user_id
        LEFT JOIN consents c
          ON c.subject_membership_id = tp.membership_id
         AND c.kind = 'recording'
      )
      SELECT *
      FROM participants
      ORDER BY display_name ASC
    `);

    return {
      dataRetentionDays: rows[0]?.data_retention_days ?? 180,
      participants: rows.map((row) => ({
        membershipId: MembershipId.of(row.membership_id),
        displayName: row.display_name,
        isMinor: row.guardian_required,
        guardianMembershipId: row.guardian_membership_id
          ? MembershipId.of(row.guardian_membership_id)
          : null,
        consentStatus: row.consent_status ?? "missing",
        grantedByMembershipId: row.granted_by_membership_id
          ? MembershipId.of(row.granted_by_membership_id)
          : null,
      })),
    };
  }

  async save(transcript: Transcript): Promise<void> {
    await this.drizzle.db
      .insert(schema.transcripts)
      .values({
        id: transcript.id.value,
        schoolId: transcript.schoolId.value,
        sessionId: transcript.sessionId,
        status: transcript.status,
        provider: transcript.provider,
        language: transcript.language,
        durationMs: transcript.durationMs,
        summary: transcript.summary,
        vocabulary: [...transcript.vocabulary],
        blockedReason: transcript.blockedReason,
        recordingStorageKey: transcript.recordingStorageKey,
        retentionUntil: transcript.retentionUntil,
        readyAt: transcript.readyAt,
      })
      .onConflictDoUpdate({
        target: schema.transcripts.sessionId,
        set: {
          status: transcript.status,
          provider: transcript.provider,
          language: transcript.language,
          durationMs: transcript.durationMs,
          summary: transcript.summary,
          vocabulary: [...transcript.vocabulary],
          blockedReason: transcript.blockedReason,
          recordingStorageKey: transcript.recordingStorageKey,
          retentionUntil: transcript.retentionUntil,
          readyAt: transcript.readyAt,
        },
      });

    await this.drizzle.db
      .delete(schema.transcriptSegments)
      .where(eq(schema.transcriptSegments.transcriptId, transcript.id.value));

    if (transcript.segments.length === 0) return;
    await this.drizzle.db.insert(schema.transcriptSegments).values(
      transcript.segments.map((segment) => ({
        schoolId: transcript.schoolId.value,
        transcriptId: transcript.id.value,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speakerMembershipId: segment.speakerMembershipId?.value ?? null,
        speakerLabel: segment.speakerLabel,
        text: segment.text,
        confidence: segment.confidenceBps,
        isTeacher: segment.isTeacher,
      })),
    );
  }

  async deleteForParticipant(membershipId: string): Promise<number> {
    const rows = await this.drizzle.db.execute<{ id: string }>(sql`
      SELECT DISTINCT t.id
      FROM transcripts t
      JOIN sessions s          ON s.id = t.session_id
      JOIN enrollments e       ON e.group_id = s.group_id AND e.status = 'active'
      JOIN student_profiles p  ON p.id = e.student_profile_id
      WHERE p.membership_id = ${membershipId}
      UNION
      SELECT DISTINCT t.id
      FROM transcripts t
      JOIN transcript_segments ts ON ts.transcript_id = t.id
      WHERE ts.speaker_membership_id = ${membershipId}
    `);
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return 0;
    await this.drizzle.db.delete(schema.transcripts).where(inArray(schema.transcripts.id, ids));
    return ids.length;
  }
}
