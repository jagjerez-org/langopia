import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { StudentEvaluated } from "../events/evaluation.events.js";
import {
  EvaluationFrozenError,
  EvaluationPeriodInFutureError,
  InvalidProgressRatingError,
} from "../errors/assessment.errors.js";
import { EvaluationId, StudentId, TeacherId } from "./identifiers.js";

const MIN_RATING = 1;
const MAX_RATING = 5;
/** Ventana de revisión: pasado esto, el historial pedagógico queda congelado. */
const REVISABLE_DAYS = 7;
const DAY_MS = 24 * 3_600_000;

/**
 * Valoración cualitativa del profesor sobre el progreso de un alumno.
 *
 * Es la pieza que convierte el CRM en una herramienta pedagógica: después de
 * la clase, el profesor deja constancia de cómo va el alumno. No es un dato
 * cualquiera — es información personal sobre una persona identificable, a
 * veces menor de edad, así que `visibleToGuardian` no es un adorno: decide
 * quién más, aparte de dirección, puede leerla.
 *
 * No comprueba aquí ni el solape con otras valoraciones ni que el profesor
 * haya impartido clase al alumno: las dos cosas necesitan consultar otras
 * valoraciones y otro contexto (`scheduling`), y un agregado no hace
 * consultas. Eso es trabajo del manejador del comando, que sí tiene los
 * puertos.
 */
export class Evaluation extends AggregateRoot<EvaluationId> {
  private constructor(
    id: EvaluationId,
    private readonly _schoolId: SchoolId,
    private readonly _teacherId: TeacherId,
    private readonly _studentId: StudentId,
    private readonly _periodStart: Date,
    private readonly _periodEnd: Date,
    private _progressRating: number,
    private _levelAtEvaluation: CefrLevel | null,
    private _strengths: string | null,
    private _improvements: string | null,
    private _nextSteps: string | null,
    private readonly _visibleToStudent: boolean,
    private _visibleToGuardian: boolean,
    private readonly _createdAt: Date,
  ) {
    super(id);
  }

  /**
   * Registra una valoración nueva.
   *
   * Con un alumno menor, `visibleToGuardian` arranca en `true`: la familia ve
   * el informe por defecto. Ocultárselo es una decisión explícita posterior
   * (`hideFromGuardian`), nunca el punto de partida.
   */
  static write(params: {
    id: EvaluationId;
    schoolId: SchoolId;
    teacherProfileId: string;
    studentProfileId: string;
    periodStart: Date;
    periodEnd: Date;
    progressRating: number;
    levelAtEvaluation?: CefrLevel | null;
    strengths?: string | null;
    improvements?: string | null;
    nextSteps?: string | null;
    studentIsMinor: boolean;
    now: Date;
  }): Evaluation {
    assertValidRating(params.progressRating);
    assertPeriodNotInFuture(params.periodEnd, params.now);

    const visibleToGuardian = params.studentIsMinor;

    const evaluation = new Evaluation(
      params.id,
      params.schoolId,
      TeacherId.of(params.teacherProfileId),
      StudentId.of(params.studentProfileId),
      params.periodStart,
      params.periodEnd,
      params.progressRating,
      params.levelAtEvaluation ?? null,
      params.strengths ?? null,
      params.improvements ?? null,
      params.nextSteps ?? null,
      true,
      visibleToGuardian,
      params.now,
    );

    evaluation.record(
      new StudentEvaluated({
        evaluationId: params.id.value,
        schoolId: params.schoolId.value,
        teacherProfileId: params.teacherProfileId,
        studentProfileId: params.studentProfileId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        progressRating: params.progressRating,
        visibleToGuardian,
      }),
    );
    return evaluation;
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: EvaluationId;
    schoolId: SchoolId;
    teacherProfileId: string;
    studentProfileId: string;
    periodStart: Date;
    periodEnd: Date;
    progressRating: number;
    levelAtEvaluation: CefrLevel | null;
    strengths: string | null;
    improvements: string | null;
    nextSteps: string | null;
    visibleToStudent: boolean;
    visibleToGuardian: boolean;
    createdAt: Date;
  }): Evaluation {
    return new Evaluation(
      props.id,
      props.schoolId,
      TeacherId.of(props.teacherProfileId),
      StudentId.of(props.studentProfileId),
      props.periodStart,
      props.periodEnd,
      props.progressRating,
      props.levelAtEvaluation,
      props.strengths,
      props.improvements,
      props.nextSteps,
      props.visibleToStudent,
      props.visibleToGuardian,
      props.createdAt,
    );
  }

  /**
   * Revisa la valoración: el profesor corrige algo dentro de los primeros
   * siete días desde que se creó. Pasado ese plazo, `EvaluationFrozenError`:
   * el historial pedagógico es un dato real y no se reescribe indefinidamente.
   *
   * Semántica PATCH: un campo ausente (`undefined`) no se toca.
   */
  revise(params: {
    now: Date;
    progressRating?: number;
    levelAtEvaluation?: CefrLevel | null;
    strengths?: string | null;
    improvements?: string | null;
    nextSteps?: string | null;
  }): void {
    this.assertRevisable(params.now);

    if (params.progressRating !== undefined) {
      assertValidRating(params.progressRating);
      this._progressRating = params.progressRating;
    }
    if (params.levelAtEvaluation !== undefined) this._levelAtEvaluation = params.levelAtEvaluation;
    if (params.strengths !== undefined) this._strengths = params.strengths;
    if (params.improvements !== undefined) this._improvements = params.improvements;
    if (params.nextSteps !== undefined) this._nextSteps = params.nextSteps;
  }

  /**
   * Oculta la valoración a la familia. Es una decisión explícita posterior,
   * nunca el punto de partida (`write` ya decidió la visibilidad inicial), y
   * queda en la auditoría de quien la llama — eso lo deja el manejador que la
   * invoque, no este método.
   */
  hideFromGuardian(): void {
    this._visibleToGuardian = false;
  }

  /**
   * Si esta valoración se solapa en el tiempo con el periodo dado. Tocarse
   * por un extremo cuenta como solape: dos valoraciones del mismo profesor al
   * mismo alumno no pueden compartir ni un día, o «la última valoración» deja
   * de tener un significado único.
   */
  overlapsWith(period: { periodStart: Date; periodEnd: Date }): boolean {
    return this._periodStart <= period.periodEnd && period.periodStart <= this._periodEnd;
  }

  private assertRevisable(now: Date): void {
    const deadline = new Date(this._createdAt.getTime() + REVISABLE_DAYS * DAY_MS);
    if (now > deadline) {
      throw new EvaluationFrozenError(this.id.value, this._createdAt, now);
    }
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get teacherId(): TeacherId {
    return this._teacherId;
  }
  get studentId(): StudentId {
    return this._studentId;
  }
  get periodStart(): Date {
    return this._periodStart;
  }
  get periodEnd(): Date {
    return this._periodEnd;
  }
  get progressRating(): number {
    return this._progressRating;
  }
  get levelAtEvaluation(): CefrLevel | null {
    return this._levelAtEvaluation;
  }
  get strengths(): string | null {
    return this._strengths;
  }
  get improvements(): string | null {
    return this._improvements;
  }
  get nextSteps(): string | null {
    return this._nextSteps;
  }
  get visibleToStudent(): boolean {
    return this._visibleToStudent;
  }
  get visibleToGuardian(): boolean {
    return this._visibleToGuardian;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}

function assertValidRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new InvalidProgressRatingError(rating);
  }
}

function assertPeriodNotInFuture(periodEnd: Date, now: Date): void {
  if (periodEnd > now) {
    throw new EvaluationPeriodInFutureError(periodEnd, now);
  }
}
