import { Inject, Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { ESTIMATED_CREDITS_RESERVE } from "../../application/commands/generate-unit/generate-unit.handler.js";
import type {
  ContentUnitDetail,
  ContentUnitAssetView,
  ContentUnitExerciseView,
  ContentUnitListItem,
  GenerationEstimate,
  LearningReadModel,
  PublishTarget,
} from "../../application/ports/learning-read-model.port.js";
import { AUDIO_EXERCISE_TYPES, type ExerciseType } from "../../domain/model/exercise-schemas.js";

/**
 * Lado de lectura de `learning` (Tarea 11 del panel).
 *
 * Consultas directas con el constructor de Drizzle, igual que
 * `DrizzleContentUnitRepository` (tarea 6) del mismo contexto — sin SQL a
 * mano, sin cargar el agregado. El `leftJoin` con la condición
 * `locale = primaryLocale` resuelve "la traducción en el idioma en que se
 * generó" sin una segunda consulta por fila.
 */
@Injectable()
export class DrizzleLearningReadModel implements LearningReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async listUnits(filter: { status?: string }): Promise<ContentUnitListItem[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db
        .select({
          contentUnitId: schema.contentUnits.id,
          code: schema.contentUnits.code,
          language: schema.contentUnits.language,
          level: schema.contentUnits.level,
          topic: schema.contentUnits.topic,
          status: schema.contentUnits.status,
          source: schema.contentUnits.source,
          creditsSpent: schema.contentUnits.creditsSpent,
          createdAt: schema.contentUnits.createdAt,
          title: schema.contentUnitTranslations.title,
        })
        .from(schema.contentUnits)
        .leftJoin(
          schema.contentUnitTranslations,
          and(
            eq(schema.contentUnitTranslations.contentUnitId, schema.contentUnits.id),
            eq(schema.contentUnitTranslations.locale, schema.contentUnits.primaryLocale),
          ),
        )
        .where(
          filter.status
            ? eq(schema.contentUnits.status, filter.status as (typeof schema.contentStatus.enumValues)[number])
            : undefined,
        )
        .orderBy(desc(schema.contentUnits.createdAt));

      return rows.map((row) => ({
        contentUnitId: row.contentUnitId,
        code: row.code,
        language: row.language,
        level: row.level,
        topic: row.topic,
        status: row.status,
        source: row.source,
        creditsSpent: row.creditsSpent,
        createdAt: row.createdAt.toISOString(),
        title: row.title ?? null,
      }));
    });
  }

  /**
   * Grupos a los que se puede publicar esta unidad (Paso 4 del brief).
   *
   * Devuelve TODOS los grupos vivos de la escuela, con `eligible` ya decidido
   * aquí (mismo idioma y nivel que la unidad) en vez de devolver solo los
   * elegibles: un selector que esconde los grupos que no encajan deja al
   * profesor preguntándose dónde está su grupo. `finished`/`canceled` sí se
   * quedan fuera — publicar a un grupo que terminó no significa nada.
   */
  async listPublishTargets(contentUnitId: string): Promise<PublishTarget[]> {
    return this.uow.read(async () => {
      const unitRows = await this.drizzle.db
        .select({
          language: schema.contentUnits.language,
          level: schema.contentUnits.level,
        })
        .from(schema.contentUnits)
        .where(eq(schema.contentUnits.id, contentUnitId))
        .limit(1);
      const unit = unitRows[0];
      if (!unit) return [];

      const rows = await this.drizzle.db
        .select({
          groupId: schema.groups.id,
          name: schema.groups.name,
          status: schema.groups.status,
          courseId: schema.courses.id,
          courseCode: schema.courses.code,
          level: schema.courses.level,
          language: schema.courses.language,
        })
        .from(schema.groups)
        .innerJoin(schema.courses, eq(schema.courses.id, schema.groups.courseId))
        .where(inArray(schema.groups.status, ["planned", "running"]))
        .orderBy(schema.courses.code, schema.groups.name);

      return rows.map((row) => ({
        groupId: row.groupId,
        name: row.name,
        courseId: row.courseId,
        courseCode: row.courseCode,
        level: row.level,
        language: row.language,
        status: row.status,
        eligible: row.level === unit.level && row.language === unit.language,
      }));
    });
  }

  async getUnitDetail(contentUnitId: string): Promise<ContentUnitDetail | null> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db
        .select({
          contentUnitId: schema.contentUnits.id,
          code: schema.contentUnits.code,
          language: schema.contentUnits.language,
          level: schema.contentUnits.level,
          topic: schema.contentUnits.topic,
          skills: schema.contentUnits.skills,
          status: schema.contentUnits.status,
          source: schema.contentUnits.source,
          primaryLocale: schema.contentUnits.primaryLocale,
          creditsSpent: schema.contentUnits.creditsSpent,
          generationCostCents: schema.contentUnits.generationCostCents,
          createdAt: schema.contentUnits.createdAt,
          reviewedAt: schema.contentUnits.reviewedAt,
          publishedAt: schema.contentUnits.publishedAt,
          title: schema.contentUnitTranslations.title,
          description: schema.contentUnitTranslations.description,
          body: schema.contentUnitTranslations.body,
        })
        .from(schema.contentUnits)
        .leftJoin(
          schema.contentUnitTranslations,
          and(
            eq(schema.contentUnitTranslations.contentUnitId, schema.contentUnits.id),
            eq(schema.contentUnitTranslations.locale, schema.contentUnits.primaryLocale),
          ),
        )
        .where(eq(schema.contentUnits.id, contentUnitId))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      const exerciseRows = await this.drizzle.db
        .select({
          exerciseId: schema.exercises.id,
          position: schema.exercises.position,
          type: schema.exercises.type,
          skill: schema.exercises.skill,
          prompt: schema.exercises.prompt,
          solution: schema.exercises.solution,
          maxScore: schema.exercises.maxScore,
          requiresTeacherValidation: schema.exercises.requiresTeacherValidation,
        })
        .from(schema.exercises)
        .where(eq(schema.exercises.contentUnitId, contentUnitId))
        .orderBy(schema.exercises.position);

      const exercises: ContentUnitExerciseView[] = exerciseRows.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        position: exercise.position,
        type: exercise.type as ExerciseType,
        skill: exercise.skill,
        prompt: exercise.prompt,
        solution: exercise.solution ?? null,
        maxScore: exercise.maxScore,
        requiresTeacherValidation: exercise.requiresTeacherValidation,
      }));

      const assetRows = await this.drizzle.db
        .select({
          assetId: schema.contentAssets.id,
          kind: schema.contentAssets.kind,
          storageKey: schema.contentAssets.storageKey,
          mimeType: schema.contentAssets.mimeType,
          durationMs: schema.contentAssets.durationMs,
          isBeta: schema.contentAssets.isBeta,
        })
        .from(schema.contentAssets)
        .where(eq(schema.contentAssets.contentUnitId, contentUnitId))
        .orderBy(schema.contentAssets.createdAt);

      const assets: ContentUnitAssetView[] = assetRows.map((asset) => ({
        assetId: asset.assetId,
        kind: asset.kind,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        durationMs: asset.durationMs,
        isBeta: asset.isBeta,
        betaNotice: asset.isBeta
          ? "Vídeo beta: puede fallar o no estar disponible para todos los alumnos."
          : null,
      }));

      return {
        contentUnitId: row.contentUnitId,
        code: row.code,
        language: row.language,
        level: row.level,
        topic: row.topic,
        skills: row.skills,
        status: row.status,
        source: row.source,
        primaryLocale: row.primaryLocale,
        creditsSpent: row.creditsSpent,
        generationCostCents: row.generationCostCents,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        title: row.title ?? "",
        description: row.description ?? "",
        body: row.body ?? "",
        exercises,
        assets,
      };
    });
  }

  /**
   * `SELECT ... FROM schools LIMIT 1` sin filtrar por escuela a mano, dentro
   * de `uow.read(...)`: mismo patrón, ya verificado en vivo, que
   * `GetSchoolTimezoneHandler` (Tarea 9 del panel) — RLS deja ver una sola
   * fila cuando `app.school_id` está fijado en la transacción.
   */
  async getGenerationEstimate(): Promise<GenerationEstimate> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db
        .select({ balance: schema.schools.aiCreditsBalance, hardLimit: schema.schools.aiHardLimit })
        .from(schema.schools)
        .limit(1);
      const row = rows[0];
      const currentBalance = row?.balance ?? 0;
      const hardLimit = row?.hardLimit ?? true;

      return {
        estimatedCredits: ESTIMATED_CREDITS_RESERVE,
        currentBalance,
        hardLimit,
        wouldBeRejected: hardLimit && currentBalance < ESTIMATED_CREDITS_RESERVE,
        // La MISMA lista que rechaza `GenerateUnitHandler`, no una copia:
        // sale del dominio, así que no pueden divergir.
        unavailableExerciseTypes: [...AUDIO_EXERCISE_TYPES],
      };
    });
  }
}
