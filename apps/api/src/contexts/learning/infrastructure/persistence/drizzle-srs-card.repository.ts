import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { SrsCard } from "../../domain/model/srs-card.aggregate.js";
import { ExerciseId, SrsCardId } from "../../domain/model/identifiers.js";
import type { SrsCardRepository } from "../../domain/ports/srs-card.repository.port.js";

/**
 * Implementación del repositorio de `SrsCard` sobre Drizzle.
 *
 * `save()` hace upsert por `id` (tabla `srs_cards`): la primera vez que un
 * alumno falla un ejercicio, `id` es nuevo y no hay conflicto; las
 * siguientes, `findByStudentAndExercise` ya trajo el `id` real y este mismo
 * método lo actualiza. `dueOn` viaja como texto `YYYY-MM-DD` en los dos
 * sentidos: la columna es `date` sin `{ mode: "date" }`, así que Drizzle ya
 * la trata como cadena — el mismo formato que espera `SrsCard`.
 */
@Injectable()
export class DrizzleSrsCardRepository implements SrsCardRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByStudentAndExercise(
    studentProfileId: string,
    exerciseId: ExerciseId,
  ): Promise<SrsCard | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.srsCards)
      .where(
        and(
          eq(schema.srsCards.studentProfileId, studentProfileId),
          eq(schema.srsCards.exerciseId, exerciseId.value),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async save(card: SrsCard): Promise<void> {
    await this.drizzle.db
      .insert(schema.srsCards)
      .values({
        id: card.id.value,
        schoolId: card.schoolId.value,
        studentProfileId: card.studentProfileId,
        exerciseId: card.exerciseId?.value ?? null,
        kind: card.exerciseId ? "exercise" : "vocabulary",
        ease: card.ease,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
        dueOn: card.dueOn,
        lastReviewedAt: card.lastReviewedAt,
      })
      .onConflictDoUpdate({
        target: schema.srsCards.id,
        set: {
          ease: card.ease,
          intervalDays: card.intervalDays,
          repetitions: card.repetitions,
          lapses: card.lapses,
          dueOn: card.dueOn,
          lastReviewedAt: card.lastReviewedAt,
        },
      });
  }

  async findDueForStudent(params: {
    studentProfileId: string;
    onOrBefore: string;
    limit: number;
  }): Promise<SrsCard[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.srsCards)
      .where(
        and(
          eq(schema.srsCards.studentProfileId, params.studentProfileId),
          eq(schema.srsCards.kind, "exercise"),
          lte(schema.srsCards.dueOn, params.onOrBefore),
        ),
      )
      .orderBy(asc(schema.srsCards.dueOn))
      .limit(params.limit);
    return rows.map(toDomain);
  }

  async createVocabularyCardsForParticipants(params: {
    schoolId: string;
    transcriptId: string;
    participantMembershipIds: readonly string[];
    vocabulary: ReadonlyArray<{ term: string; lemma?: string; level?: string; count: number }>;
    dueOn: string;
    now: Date;
  }): Promise<number> {
    if (params.participantMembershipIds.length === 0 || params.vocabulary.length === 0) return 0;
    const values = params.vocabulary.map((item) => ({
      term: item.term,
      definition: item.lemma ?? item.term,
      level: item.level ?? null,
    }));

    const rows = await this.drizzle.db.execute<{ id: string }>(sql`
      WITH vocabulary(term, definition, level) AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb)
          AS x(term text, definition text, level cefr_level)
      ),
      students AS (
        SELECT id AS student_profile_id
        FROM student_profiles
        WHERE membership_id = ANY(${params.participantMembershipIds}::uuid[])
      )
      INSERT INTO srs_cards (
        school_id,
        student_profile_id,
        kind,
        source_transcript_id,
        term,
        definition,
        level,
        ease,
        interval_days,
        repetitions,
        lapses,
        due_on,
        last_reviewed_at
      )
      SELECT
        ${params.schoolId},
        students.student_profile_id,
        'vocabulary',
        ${params.transcriptId},
        vocabulary.term,
        vocabulary.definition,
        vocabulary.level,
        2.5,
        1,
        0,
        0,
        ${params.dueOn},
        ${params.now}
      FROM students
      CROSS JOIN vocabulary
      ON CONFLICT (student_profile_id, source_transcript_id, lower(term))
      DO UPDATE SET
        definition = EXCLUDED.definition,
        level = EXCLUDED.level,
        due_on = LEAST(srs_cards.due_on, EXCLUDED.due_on),
        last_reviewed_at = EXCLUDED.last_reviewed_at
      RETURNING id
    `);
    return rows.length;
  }
}

function toDomain(row: typeof schema.srsCards.$inferSelect): SrsCard {
  return SrsCard.rehydrate({
    id: SrsCardId.of(row.id),
    schoolId: SchoolId.of(row.schoolId),
    studentProfileId: row.studentProfileId,
    exerciseId: row.exerciseId ? ExerciseId.of(row.exerciseId) : null,
    ease: row.ease,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    lapses: row.lapses,
    dueOn: row.dueOn,
    lastReviewedAt: row.lastReviewedAt,
  });
}
