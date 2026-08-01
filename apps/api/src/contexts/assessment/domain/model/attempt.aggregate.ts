import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  AttemptAiGraded,
  AttemptReturnedToStudent,
  AttemptSubmitted,
  AttemptTeacherValidated,
} from "../events/attempt.events.js";
import {
  EmptyAttemptResponseError,
  InvalidAttemptScoreError,
  InvalidAttemptStateError,
  MaxAttemptsExceededError,
} from "../errors/assessment.errors.js";
import { AttemptId, ExerciseId } from "./identifiers.js";

/** Espejo de `attempt_status` (`packages/db/src/schema/enums.ts`), comprobado en `enums-match-db.spec.ts`. */
export const AttemptStatus = {
  /** Reservado por el esquema para exámenes cronometrados; esta tarea no lo produce. */
  InProgress: "in_progress",
  Submitted: "submitted",
  AiGraded: "ai_graded",
  TeacherValidated: "teacher_validated",
  Returned: "returned",
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

/** Desde qué estados puede partir cada transición. */
const ALLOWED_FROM: Record<string, readonly AttemptStatus[]> = {
  gradeWithAi: [AttemptStatus.Submitted],
  validate: [AttemptStatus.Submitted, AttemptStatus.AiGraded],
  returnToStudent: [AttemptStatus.Submitted, AttemptStatus.AiGraded],
};

/**
 * Intento de un alumno sobre un ejercicio.
 *
 * Es la frontera de responsabilidad de la ola: `submitted` → `ai_graded` →
 * `teacher_validated`. Solo el último cuenta para el expediente
 * (`countsForRecord`) — no hay excepción ni interruptor que lo salte, es
 * literalmente el único estado desde el que `countsForRecord` responde
 * `true`. `ai_graded` puede llegar de una corrección real de IA o de una
 * comprobación automática determinista (ambas comparten el mismo estado: la
 * regla de la ola no distingue una de otra, las dos son «propuesta, no
 * firma»); ese cálculo vive en el manejador del comando, no aquí — `Attempt`
 * solo sabe REGISTRAR una nota ya calculada y vigilar la transición.
 *
 * `validate()` acepta partir de `submitted` además de `ai_graded`: si la
 * corrección automática no está disponible (sin `ANTHROPIC_API_KEY`, o un
 * tipo sin corrector, como `shadowing`), el profesor tiene que poder firmar
 * igualmente sin quedar bloqueado a que exista una propuesta de la IA.
 *
 * `returnToStudent()` no borra nada: el intento devuelto queda en `returned`
 * y uno nuevo (con `attemptNumber` mayor) empieza su propio ciclo. El
 * historial completo de intentos es dato pedagógico.
 */
export class Attempt extends AggregateRoot<AttemptId> {
  private constructor(
    id: AttemptId,
    private readonly _schoolId: SchoolId,
    private readonly _exerciseId: ExerciseId,
    private readonly _studentProfileId: string,
    private readonly _sessionId: string | null,
    private readonly _assessmentId: string | null,
    private readonly _attemptNumber: number,
    private readonly _response: Record<string, unknown>,
    private _status: AttemptStatus,
    private _aiScore: number | null,
    private _aiFeedback: string | null,
    private _aiRubricScores: Record<string, number> | null,
    private _aiModel: string | null,
    private _aiCostCents: number,
    private _teacherScore: number | null,
    private _teacherFeedback: string | null,
    private _validatedByMembershipId: string | null,
    private _validatedAt: Date | null,
    private readonly _startedAt: Date | null,
    private readonly _submittedAt: Date,
    private readonly _durationMs: number | null,
  ) {
    super(id);
  }

  /**
   * Un alumno envía su respuesta a un ejercicio.
   *
   * `attemptNumber` y `maxAttempts` los calcula y los pasa el manejador del
   * comando (cuántos intentos previos hay ya, y el tope del ejercicio): un
   * agregado nunca consulta la base de datos para contarlos él mismo.
   */
  static submit(params: {
    id: AttemptId;
    schoolId: SchoolId;
    exerciseId: ExerciseId;
    studentProfileId: string;
    sessionId?: string | null;
    assessmentId?: string | null;
    attemptNumber: number;
    maxAttempts: number;
    response: Record<string, unknown>;
    startedAt?: Date | null;
    durationMs?: number | null;
    now: Date;
  }): Attempt {
    if (params.attemptNumber > params.maxAttempts) {
      throw new MaxAttemptsExceededError(
        params.exerciseId.value,
        params.attemptNumber,
        params.maxAttempts,
      );
    }
    if (!params.response || Object.keys(params.response).length === 0) {
      throw new EmptyAttemptResponseError(params.exerciseId.value);
    }

    const attempt = new Attempt(
      params.id,
      params.schoolId,
      params.exerciseId,
      params.studentProfileId,
      params.sessionId ?? null,
      params.assessmentId ?? null,
      params.attemptNumber,
      params.response,
      AttemptStatus.Submitted,
      null,
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      null,
      params.startedAt ?? null,
      params.now,
      params.durationMs ?? null,
    );

    attempt.record(
      new AttemptSubmitted({
        attemptId: params.id.value,
        schoolId: params.schoolId.value,
        exerciseId: params.exerciseId.value,
        studentProfileId: params.studentProfileId,
        attemptNumber: params.attemptNumber,
      }),
    );
    return attempt;
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: AttemptId;
    schoolId: SchoolId;
    exerciseId: ExerciseId;
    studentProfileId: string;
    sessionId: string | null;
    assessmentId: string | null;
    attemptNumber: number;
    response: Record<string, unknown>;
    status: AttemptStatus;
    aiScore: number | null;
    aiFeedback: string | null;
    aiRubricScores: Record<string, number> | null;
    aiModel: string | null;
    aiCostCents: number;
    teacherScore: number | null;
    teacherFeedback: string | null;
    validatedByMembershipId: string | null;
    validatedAt: Date | null;
    startedAt: Date | null;
    submittedAt: Date;
    durationMs: number | null;
  }): Attempt {
    return new Attempt(
      props.id,
      props.schoolId,
      props.exerciseId,
      props.studentProfileId,
      props.sessionId,
      props.assessmentId,
      props.attemptNumber,
      props.response,
      props.status,
      props.aiScore,
      props.aiFeedback,
      props.aiRubricScores,
      props.aiModel,
      props.aiCostCents,
      props.teacherScore,
      props.teacherFeedback,
      props.validatedByMembershipId,
      props.validatedAt,
      props.startedAt,
      props.submittedAt,
      props.durationMs,
    );
  }

  /**
   * Registra una propuesta de nota: de una corrección real de IA (rúbrica) o
   * de una comprobación automática determinista (el resto de tipos). No
   * cuenta para el expediente todavía — hace falta `validate()`.
   */
  gradeWithAi(params: {
    score: number;
    feedback: string;
    rubricScores?: Record<string, number> | null;
    model: string | null;
    costCents: number;
    now: Date;
  }): void {
    this.assertCanTransition("gradeWithAi");
    assertValidScore(params.score);

    this._aiScore = params.score;
    this._aiFeedback = params.feedback;
    this._aiRubricScores = params.rubricScores ?? null;
    this._aiModel = params.model;
    this._aiCostCents = params.costCents;
    this._status = AttemptStatus.AiGraded;

    this.record(
      new AttemptAiGraded({
        attemptId: this.id.value,
        schoolId: this._schoolId.value,
        exerciseId: this._exerciseId.value,
        studentProfileId: this._studentProfileId,
        aiScore: params.score,
      }),
    );
  }

  /**
   * El profesor firma. Puede subir o bajar la nota de la IA sin restricción
   * —queda registrado quién y cuándo—, y puede hacerlo directamente desde
   * `submitted` si no hubo (o no cuajó) una propuesta de la IA antes.
   */
  validate(params: {
    teacherScore: number;
    teacherFeedback?: string | null;
    membershipId: string;
    now: Date;
  }): void {
    this.assertCanTransition("validate");
    assertValidScore(params.teacherScore);

    this._teacherScore = params.teacherScore;
    this._teacherFeedback = params.teacherFeedback ?? null;
    this._validatedByMembershipId = params.membershipId;
    this._validatedAt = params.now;
    this._status = AttemptStatus.TeacherValidated;

    this.record(
      new AttemptTeacherValidated({
        attemptId: this.id.value,
        schoolId: this._schoolId.value,
        exerciseId: this._exerciseId.value,
        studentProfileId: this._studentProfileId,
        teacherScore: params.teacherScore,
        validatedByMembershipId: params.membershipId,
      }),
    );
  }

  /**
   * Devuelve el intento al alumno para que lo rehaga. No borra nada: este
   * intento queda en `returned`, y el siguiente (con `attemptNumber` mayor)
   * es el que empieza de cero — el historial pedagógico se conserva entero.
   */
  returnToStudent(params: { teacherFeedback: string; membershipId: string; now: Date }): void {
    this.assertCanTransition("returnToStudent");

    this._teacherFeedback = params.teacherFeedback;
    this._validatedByMembershipId = params.membershipId;
    this._validatedAt = params.now;
    this._status = AttemptStatus.Returned;

    this.record(
      new AttemptReturnedToStudent({
        attemptId: this.id.value,
        schoolId: this._schoolId.value,
        exerciseId: this._exerciseId.value,
        studentProfileId: this._studentProfileId,
        returnedByMembershipId: params.membershipId,
      }),
    );
  }

  private assertCanTransition(action: keyof typeof ALLOWED_FROM): void {
    const allowed = ALLOWED_FROM[action]!;
    if (!allowed.includes(this._status)) {
      throw new InvalidAttemptStateError(this.id.value, action, this._status);
    }
  }

  /**
   * La única pregunta que de verdad importa de este agregado: esta nota,
   * ¿cuenta para el expediente? Solo `teacher_validated` responde que sí — la
   * IA propone, el profesor firma, sin excepción ni interruptor que lo salte.
   */
  get countsForRecord(): boolean {
    return this._status === AttemptStatus.TeacherValidated;
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get exerciseId(): ExerciseId {
    return this._exerciseId;
  }
  get studentProfileId(): string {
    return this._studentProfileId;
  }
  get sessionId(): string | null {
    return this._sessionId;
  }
  get assessmentId(): string | null {
    return this._assessmentId;
  }
  get attemptNumber(): number {
    return this._attemptNumber;
  }
  get response(): Record<string, unknown> {
    return this._response;
  }
  get status(): AttemptStatus {
    return this._status;
  }
  get aiScore(): number | null {
    return this._aiScore;
  }
  get aiFeedback(): string | null {
    return this._aiFeedback;
  }
  get aiRubricScores(): Record<string, number> | null {
    return this._aiRubricScores;
  }
  get aiModel(): string | null {
    return this._aiModel;
  }
  get aiCostCents(): number {
    return this._aiCostCents;
  }
  get teacherScore(): number | null {
    return this._teacherScore;
  }
  get teacherFeedback(): string | null {
    return this._teacherFeedback;
  }
  get validatedByMembershipId(): string | null {
    return this._validatedByMembershipId;
  }
  get validatedAt(): Date | null {
    return this._validatedAt;
  }
  get startedAt(): Date | null {
    return this._startedAt;
  }
  get submittedAt(): Date {
    return this._submittedAt;
  }
  get durationMs(): number | null {
    return this._durationMs;
  }
}

function assertValidScore(score: number): void {
  if (!Number.isFinite(score) || score < 0) throw new InvalidAttemptScoreError(score);
}
