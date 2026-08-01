import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { ContentUnitArchived, ContentUnitPublished } from "../events/content-unit.events.js";
import {
  ContentUnitAlreadyPublishedError,
  ContentUnitArchivedError,
  ContentUnitHasNoExercisesError,
  ContentUnitLevelMismatchError,
  ContentUnitNotInDraftError,
} from "../errors/learning.errors.js";
import { ContentUnitId, CourseId, ExerciseId } from "./identifiers.js";

/** Espejo de `content_status` (`packages/db/src/schema/enums.ts`). */
export const ContentStatus = {
  Draft: "draft",
  InReview: "in_review", // generada, esperando validación del profesor
  Published: "published",
  Archived: "archived",
} as const;

export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];

/** Espejo de `content_source` (`packages/db/src/schema/enums.ts`). */
export const ContentSource = {
  AiGenerated: "ai_generated",
  Uploaded: "uploaded", // material propio de la escuela
  Hybrid: "hybrid", // generado a partir de material propio
} as const;

export type ContentSource = (typeof ContentSource)[keyof typeof ContentSource];

/** Estados que ya no admiten ningún cambio: la unidad está archivada. */
const CLOSED_STATUSES: readonly ContentStatus[] = [ContentStatus.Archived];

/**
 * Unidad didáctica.
 *
 * Es la pieza que genera la IA y que el profesor revisa antes de publicar:
 * `in_review` → `published` es la frontera donde una persona se hace
 * responsable de lo que ve el alumno («la IA propone, el profesor firma»).
 *
 * Lo que NO está en este agregado, y por qué:
 *
 *   · Los EJERCICIOS son su propia entidad (tarea 2), con su propia tabla y
 *     su propio esquema de validación por tipo. Aquí solo se conoce SU
 *     IDENTIDAD (`addExercise`), lo justo para saber si la unidad puede
 *     publicarse — no hace falta cargar once tipos de ejercicio distintos
 *     para decidir si la lista está vacía.
 *
 *   · El CURSO al que se asocia vive en `catalog`. Este agregado nunca lo
 *     consulta: quien lo asocia (el manejador del comando, con su propio
 *     puerto) le entrega el nivel del curso ya resuelto, y la comprobación
 *     de que coincide con el de la unidad es aritmética pura sobre ese dato.
 */
export class ContentUnit extends AggregateRoot<ContentUnitId> {
  private constructor(
    id: ContentUnitId,
    private readonly _schoolId: SchoolId,
    private readonly _code: string,
    private readonly _language: string,
    private readonly _level: CefrLevel,
    private readonly _topic: string,
    private readonly _skills: readonly string[],
    private readonly _source: ContentSource,
    private _status: ContentStatus,
    private readonly _primaryLocale: string,
    /** No es `readonly`: `assignToCourse()` lo fija al publicar a grupos (tarea 11 del panel). */
    private _courseId: CourseId | null,
    private readonly _createdBy: MembershipId,
    private readonly _createdAt: Date,
    private _reviewedBy: MembershipId | null,
    private _reviewedAt: Date | null,
    private _publishedAt: Date | null,
    private _archivedAt: Date | null,
    private readonly _exerciseIds: Set<string>,
    private _generationCostCents: number,
    private _creditsSpent: number,
  ) {
    super(id);
  }

  /**
   * Da de alta una unidad nueva.
   *
   * El estado de partida depende de quién la escribió, no de quién la pide:
   * lo generado por IA (`ai_generated`, `hybrid`) nace en `in_review` porque
   * nadie lo ha validado todavía, y nunca en `published` directamente. Lo
   * `uploaded` nace en `draft` — puede publicarse sin pasar por revisión
   * porque el material propio ya lo revisó quien lo subió.
   */
  static draft(params: {
    id: ContentUnitId;
    schoolId: SchoolId;
    code: string;
    language: string;
    level: CefrLevel;
    topic: string;
    skills: string[];
    source: ContentSource;
    primaryLocale: string;
    createdBy: MembershipId;
    /** El curso al que se asocia, con su nivel ya resuelto por quien llama. */
    course?: { id: CourseId; level: CefrLevel } | null;
    now: Date;
  }): ContentUnit {
    if (params.course && params.course.level !== params.level) {
      throw new ContentUnitLevelMismatchError(params.level, params.course.level);
    }

    const status = params.source === ContentSource.Uploaded ? ContentStatus.Draft : ContentStatus.InReview;

    return new ContentUnit(
      params.id,
      params.schoolId,
      params.code,
      params.language,
      params.level,
      params.topic,
      [...params.skills],
      params.source,
      status,
      params.primaryLocale,
      params.course?.id ?? null,
      params.createdBy,
      params.now,
      null,
      null,
      null,
      null,
      new Set(),
      0,
      0,
    );
  }

  /**
   * Reconstruye una unidad ya persistida (tarea 6: `publish-unit` necesita
   * cargarla para comprobar sus invariantes — p. ej. que tiene ejercicios —
   * antes de publicarla). No valida nada ni emite eventos: lo guardado ya
   * pasó las reglas cuando se creó, igual que `CreditBalance.rehydrate()`.
   */
  static rehydrate(params: {
    id: ContentUnitId;
    schoolId: SchoolId;
    code: string;
    language: string;
    level: CefrLevel;
    topic: string;
    skills: readonly string[];
    source: ContentSource;
    status: ContentStatus;
    primaryLocale: string;
    courseId: CourseId | null;
    createdBy: MembershipId;
    createdAt: Date;
    reviewedBy: MembershipId | null;
    reviewedAt: Date | null;
    publishedAt: Date | null;
    archivedAt: Date | null;
    exerciseIds: readonly string[];
    generationCostCents: number;
    creditsSpent: number;
  }): ContentUnit {
    return new ContentUnit(
      params.id,
      params.schoolId,
      params.code,
      params.language,
      params.level,
      params.topic,
      [...params.skills],
      params.source,
      params.status,
      params.primaryLocale,
      params.courseId,
      params.createdBy,
      params.createdAt,
      params.reviewedBy,
      params.reviewedAt,
      params.publishedAt,
      params.archivedAt,
      new Set(params.exerciseIds),
      params.generationCostCents,
      params.creditsSpent,
    );
  }

  /** Añade un ejercicio ya creado aparte (tarea 2). Solo se registra su identidad. */
  addExercise(exerciseId: ExerciseId): void {
    this._exerciseIds.add(exerciseId.value);
  }

  /**
   * Asocia la unidad a un curso, con la MISMA regla de nivel que `draft()`:
   * una unidad B1 no se cuelga de un curso A2.
   *
   * Existe porque una unidad generada nace sin curso —el formulario de
   * generación (tarea 11 del panel) pide idioma, nivel y tema, no un curso— y
   * es al publicarla cuando se elige a qué grupos llega. Publicar y asociar
   * son dos decisiones distintas y por eso son dos métodos: se puede
   * reasignar una unidad ya publicada sin volver a firmarla, y se puede
   * publicar sin curso (queda visible en el catálogo interno, sin llegar a
   * ningún grupo todavía).
   */
  assignToCourse(course: { id: CourseId; level: CefrLevel }): void {
    this.assertNotArchived("asociar a un curso");
    if (course.level !== this._level) {
      throw new ContentUnitLevelMismatchError(this._level, course.level);
    }
    this._courseId = course.id;
  }

  /** Envía un borrador a revisión. Solo tiene sentido desde `draft`. */
  submitForReview(): void {
    this.assertNotArchived("enviar a revisión");
    if (this._status !== ContentStatus.Draft) {
      throw new ContentUnitNotInDraftError(this.id.value, this._status);
    }
    this._status = ContentStatus.InReview;
  }

  /**
   * Publica la unidad.
   *
   * Exige un revisor de carne y hueso (`reviewedBy: MembershipId`, no
   * opcional): la firma es de una persona, no del sistema. Vale igual desde
   * `draft` (material `uploaded`) que desde `in_review` (lo generado por
   * IA), pero nunca sin ejercicios ni dos veces.
   */
  publish(params: { reviewedBy: MembershipId; now: Date }): void {
    this.assertNotArchived("publicar");
    if (this._status === ContentStatus.Published) {
      throw new ContentUnitAlreadyPublishedError(this.id.value);
    }
    if (this._exerciseIds.size === 0) {
      throw new ContentUnitHasNoExercisesError(this.id.value);
    }

    this._status = ContentStatus.Published;
    this._reviewedBy = params.reviewedBy;
    this._reviewedAt = params.now;
    this._publishedAt = params.now;

    this.record(
      new ContentUnitPublished({
        contentUnitId: this.id.value,
        schoolId: this._schoolId.value,
        courseId: this._courseId?.value ?? null,
        language: this._language,
        level: this._level,
        reviewedByMembershipId: params.reviewedBy.value,
      }),
    );
  }

  /** Archiva la unidad. No vuelve atrás: ni se publica, ni se revisa, ni se archiva otra vez. */
  archive(params: { now: Date }): void {
    this.assertNotArchived("archivar");

    this._status = ContentStatus.Archived;
    this._archivedAt = params.now;

    this.record(
      new ContentUnitArchived({ contentUnitId: this.id.value, schoolId: this._schoolId.value }),
    );
  }

  /**
   * Registra el coste de una generación (tarea 3). Se acumula, no se
   * sobrescribe: una unidad puede pasar por varias llamadas al modelo — el
   * esquema, los ejercicios, alguna corrección — y todas cuentan para el
   * margen.
   */
  recordGenerationCost(params: { costCents: number; credits: number }): void {
    this._generationCostCents += params.costCents;
    this._creditsSpent += params.credits;
  }

  private assertNotArchived(action: string): void {
    if (CLOSED_STATUSES.includes(this._status)) {
      throw new ContentUnitArchivedError(this.id.value, action);
    }
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get code(): string {
    return this._code;
  }
  get language(): string {
    return this._language;
  }
  get level(): CefrLevel {
    return this._level;
  }
  get topic(): string {
    return this._topic;
  }
  get skills(): readonly string[] {
    return this._skills;
  }
  get source(): ContentSource {
    return this._source;
  }
  get status(): ContentStatus {
    return this._status;
  }
  get primaryLocale(): string {
    return this._primaryLocale;
  }
  get courseId(): CourseId | null {
    return this._courseId;
  }
  get createdBy(): MembershipId {
    return this._createdBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get reviewedBy(): MembershipId | null {
    return this._reviewedBy;
  }
  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }
  get publishedAt(): Date | null {
    return this._publishedAt;
  }
  get archivedAt(): Date | null {
    return this._archivedAt;
  }
  get exerciseIds(): readonly string[] {
    return [...this._exerciseIds];
  }
  get hasExercises(): boolean {
    return this._exerciseIds.size > 0;
  }
  get generationCostCents(): number {
    return this._generationCostCents;
  }
  get creditsSpent(): number {
    return this._creditsSpent;
  }
}
