import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import {
  ContentSource,
  ContentStatus,
  ContentUnit,
} from "../../domain/model/content-unit.aggregate.js";
import type { Exercise } from "../../domain/model/exercise.entity.js";
import { ContentUnitId, CourseId, type ExerciseId } from "../../domain/model/identifiers.js";
import type {
  ContentUnitRepository,
  ContentUnitTranslation,
  ExerciseSrsInfo,
  RubricRef,
} from "../../domain/ports/content-unit.repository.port.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * `save()` hace upsert sobre `content_units` (la unidad se crea una vez, en
 * `generate-unit`, y se actualiza al menos una vez más al publicarla). Las
 * traducciones y los ejercicios se guardan aparte: no son parte del
 * agregado (ver el puerto).
 */
@Injectable()
export class DrizzleContentUnitRepository implements ContentUnitRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async save(unit: ContentUnit): Promise<void> {
    await this.drizzle.db
      .insert(schema.contentUnits)
      .values({
        id: unit.id.value,
        schoolId: unit.schoolId.value,
        courseId: unit.courseId?.value ?? null,
        code: unit.code,
        language: unit.language,
        level: unit.level,
        skills: unit.skills as (typeof schema.languageSkill.enumValues)[number][],
        topic: unit.topic,
        source: unit.source,
        status: unit.status,
        primaryLocale: unit.primaryLocale,
        generationCostCents: unit.generationCostCents,
        creditsSpent: unit.creditsSpent,
        createdByMembershipId: unit.createdBy.value,
        reviewedByMembershipId: unit.reviewedBy?.value ?? null,
        reviewedAt: unit.reviewedAt,
        publishedAt: unit.publishedAt,
        archivedAt: unit.archivedAt,
        createdAt: unit.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.contentUnits.id,
        set: {
          courseId: unit.courseId?.value ?? null,
          status: unit.status,
          generationCostCents: unit.generationCostCents,
          creditsSpent: unit.creditsSpent,
          reviewedByMembershipId: unit.reviewedBy?.value ?? null,
          reviewedAt: unit.reviewedAt,
          publishedAt: unit.publishedAt,
          archivedAt: unit.archivedAt,
        },
      });
  }

  async saveTranslation(unit: ContentUnit, translation: ContentUnitTranslation): Promise<void> {
    await this.drizzle.db
      .insert(schema.contentUnitTranslations)
      .values({
        schoolId: unit.schoolId.value,
        contentUnitId: unit.id.value,
        locale: translation.locale,
        title: translation.title,
        description: translation.description,
        body: translation.body,
        machineTranslated: translation.machineTranslated ?? false,
      })
      .onConflictDoUpdate({
        target: [schema.contentUnitTranslations.contentUnitId, schema.contentUnitTranslations.locale],
        set: {
          title: translation.title,
          description: translation.description,
          body: translation.body,
          machineTranslated: translation.machineTranslated ?? false,
        },
      });
  }

  async addExercises(unit: ContentUnit, exercises: readonly Exercise[]): Promise<void> {
    if (exercises.length === 0) return;

    await this.drizzle.db.insert(schema.exercises).values(
      exercises.map((exercise, index) => ({
        id: exercise.id.value,
        schoolId: unit.schoolId.value,
        contentUnitId: unit.id.value,
        position: index + 1,
        type: exercise.type,
        skill: (exercise.skill ?? "vocabulary") as (typeof schema.languageSkill.enumValues)[number],
        level: unit.level,
        prompt: exercise.prompt,
        solution: exercise.solution ?? null,
        rubricId: exercise.rubricId,
        maxScore: exercise.maxScore,
        srsEnabled: exercise.srsEnabled,
        requiresTeacherValidation: exercise.requiresTeacherValidation,
      })),
    );
  }

  async findById(id: ContentUnitId): Promise<ContentUnit | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.contentUnits)
      .where(eq(schema.contentUnits.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const exerciseRows = await this.drizzle.db
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(eq(schema.exercises.contentUnitId, id.value))
      .orderBy(schema.exercises.position);

    return ContentUnit.rehydrate({
      id: ContentUnitId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      code: row.code,
      language: row.language,
      level: row.level as CefrLevel,
      topic: row.topic,
      skills: row.skills,
      source: row.source as ContentSource,
      status: row.status as ContentStatus,
      primaryLocale: row.primaryLocale,
      courseId: row.courseId ? CourseId.of(row.courseId) : null,
      createdBy: MembershipId.of(row.createdByMembershipId!),
      createdAt: row.createdAt,
      reviewedBy: row.reviewedByMembershipId ? MembershipId.of(row.reviewedByMembershipId) : null,
      reviewedAt: row.reviewedAt,
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      exerciseIds: exerciseRows.map((e) => e.id),
      generationCostCents: row.generationCostCents,
      creditsSpent: row.creditsSpent,
    });
  }

  async findRubricIdByCode(code: string): Promise<RubricRef | null> {
    const rows = await this.drizzle.db
      .select({ id: schema.rubrics.id, maxScore: schema.rubrics.maxScore })
      .from(schema.rubrics)
      .where(eq(schema.rubrics.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async findExerciseSrsInfo(exerciseId: ExerciseId): Promise<ExerciseSrsInfo | null> {
    const rows = await this.drizzle.db
      .select({ maxScore: schema.exercises.maxScore, srsEnabled: schema.exercises.srsEnabled })
      .from(schema.exercises)
      .where(eq(schema.exercises.id, exerciseId.value))
      .limit(1);
    return rows[0] ?? null;
  }
}
