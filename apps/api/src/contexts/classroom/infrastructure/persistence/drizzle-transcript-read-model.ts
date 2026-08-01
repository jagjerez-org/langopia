import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  TranscriptReadModel,
  TranscriptSegmentView,
  TranscriptView,
} from "../../application/ports/transcript-read-model.port.js";

@Injectable()
export class DrizzleTranscriptReadModel implements TranscriptReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async listRecent(): Promise<TranscriptView[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        transcript_id: string;
        session_id: string;
        title: string;
        starts_at: Date;
        status: TranscriptView["status"];
        provider: string;
        language: string;
        duration_ms: number | null;
        summary: string | null;
        blocked_reason: string | null;
        ready_at: Date | null;
      }>(sql`
        SELECT
          t.id AS transcript_id,
          t.session_id,
          COALESCE(NULLIF(s.topic, ''), g.name, c.code) AS title,
          s.scheduled_start AS starts_at,
          t.status,
          t.provider,
          t.language,
          t.duration_ms,
          t.summary,
          t.blocked_reason,
          t.ready_at
        FROM transcripts t
        JOIN sessions s ON s.id = t.session_id
        JOIN groups g   ON g.id = s.group_id
        JOIN courses c  ON c.id = g.course_id
        ORDER BY s.scheduled_start DESC, t.created_at DESC
        LIMIT 50
      `);

      const ids = rows.map((row) => row.transcript_id);
      const segmentsByTranscript = new Map<string, TranscriptSegmentView[]>();
      if (ids.length > 0) {
        const segmentRows = await this.drizzle.db.execute<{
          transcript_id: string;
          segment_id: string;
          start_ms: number;
          end_ms: number;
          speaker_label: string | null;
          text: string;
          is_teacher: boolean;
        }>(sql`
          SELECT
            transcript_id,
            id AS segment_id,
            start_ms,
            end_ms,
            speaker_label,
            text,
            is_teacher
          FROM transcript_segments
          WHERE transcript_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
          ORDER BY transcript_id, start_ms
        `);
        for (const row of segmentRows) {
          const list = segmentsByTranscript.get(row.transcript_id) ?? [];
          list.push({
            segmentId: row.segment_id,
            startMs: Number(row.start_ms),
            endMs: Number(row.end_ms),
            speakerLabel: row.speaker_label,
            text: row.text,
            isTeacher: row.is_teacher,
          });
          segmentsByTranscript.set(row.transcript_id, list);
        }
      }

      return rows.map((row) => ({
        transcriptId: row.transcript_id,
        sessionId: row.session_id,
        title: row.title,
        startsAt: toIso(row.starts_at),
        status: row.status,
        provider: row.provider,
        language: row.language,
        durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
        summary: row.summary,
        blockedReason: row.blocked_reason,
        readyAt: row.ready_at ? toIso(row.ready_at) : null,
        segments: segmentsByTranscript.get(row.transcript_id) ?? [],
      }));
    });
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
