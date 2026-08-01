import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  ExamAiGraded,
  ExamGenerated,
  ExamLevelUpgradeProposed,
  ExamStarted,
  ExamSubmitted,
  ExamTeacherValidated,
} from "../events/exam.events.js";
import {
  EmptyExamSubmissionError,
  ExamHasNoItemsError,
  ExamItemDuplicatesPracticeError,
  ExamMockFrameworkRequiredError,
  ExamRequiresSourceUnitsError,
  ExamScheduledInPastError,
  ExamSkillDistributionInvalidError,
  ExamSourceUnitNotPublishedError,
  InvalidExamScoreError,
  InvalidExamStateError,
} from "../errors/assessment.errors.js";
import { ExamId } from "./identifiers.js";

/** Espejo de `assessment_status` (`packages/db/src/schema/enums.ts`), comprobado en `enums-match-db.spec.ts`. */
export const ExamStatus = {
  Scheduled: "scheduled",
  InProgress: "in_progress",
  Submitted: "submitted",
  AiGraded: "ai_graded",
  TeacherValidated: "teacher_validated",
  Canceled: "canceled",
} as const;

export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

/** Espejo de `assessment_kind`, restringido a los tres que produce `Exam` (`placement` es `PlacementTest`, tarea 8). */
export type ExamKind = "unit_exam" | "level_exam" | "mock_official";

/** Un ítem ya generado (variante de contenido, nunca un ejercicio de práctica reutilizado). */
export interface ExamItem {
  readonly id: string;
  /** Ejercicio real de práctica del que es variante, si lo hay: trazabilidad para «no repetir literalmente». */
  readonly sourceExerciseId: string | null;
  readonly sourceContentUnitId: string;
  readonly type: string;
  readonly skill: string;
  readonly level: string;
  readonly prompt: Record<string, unknown>;
  /** `null` en los tipos que se corrigen con rúbrica. */
  readonly solution: Record<string, unknown> | null;
  readonly rubricId: string | null;
  /** Código de la rúbrica (`mcer-escrita`, `mcer-oral`...), para poder recuperar sus criterios al corregir sin volver a preguntarle a `learning` qué ejercicio la usó. */
  readonly rubricCode: string | null;
  readonly maxScore: number;
  readonly response: Record<string, unknown> | null;
  readonly result: ExamItemResult | null;
}

export interface ExamItemResult {
  readonly score: number;
  readonly feedback: string;
  readonly model: string | null;
  readonly costCents: number;
}

export interface ExamSection {
  readonly skill: string;
  readonly durationMinutes: number;
  readonly items: readonly ExamItem[];
}

/** Forma mutable de `ExamSection`: la que usa el agregado por dentro para poder registrar `response`/`result` en cada ítem con `submit()`/`grade()`. */
interface MutableExamSection {
  skill: string;
  durationMinutes: number;
  items: ExamItem[];
}

/** Lo mínimo de una unidad de origen que el agregado necesita para decidir si puede examinar de ella. */
export interface ExamSourceUnitRef {
  readonly id: string;
  readonly status: string;
}

/** El mismo dato de un ejercicio de práctica ya existente, para comprobar que ningún ítem lo repite literalmente. */
export interface PracticeExerciseRef {
  readonly type: string;
  readonly prompt: Record<string, unknown>;
}

const PUBLISHED = "published";

/** Umbral de aprobado sobre el que un `level_exam` propone subir de nivel MCER: 70 %, sin excepción documentada aparte. */
const LEVEL_UPGRADE_PASS_RATIO = 0.7;

const LEVEL_ORDER: readonly CefrLevel[] = [
  CefrLevel.A1,
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
  CefrLevel.C2,
];

function nextLevel(level: CefrLevel): CefrLevel | null {
  const index = LEVEL_ORDER.indexOf(level);
  if (index < 0 || index >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[index + 1]!;
}

function assertValidScore(score: number): void {
  if (!Number.isFinite(score) || score < 0) throw new InvalidExamScoreError(score);
}

/** Desde qué estados puede partir cada transición. */
const ALLOWED_FROM: Record<string, readonly ExamStatus[]> = {
  schedule: [ExamStatus.Scheduled],
  start: [ExamStatus.Scheduled],
  submit: [ExamStatus.InProgress],
  grade: [ExamStatus.Submitted],
  validate: [ExamStatus.Submitted, ExamStatus.AiGraded],
};

/**
 * Examen (Tarea 15 de la ola 2).
 *
 * No es «una unidad más»: se corrige, se pone nota, y esa nota va al
 * expediente. La misma frontera de responsabilidad que `Attempt` (tarea 7),
 * aplicada a un examen completo en vez de a un único ejercicio —
 * `scheduled` → `in_progress` → `submitted` → `ai_graded` →
 * `teacher_validated`, y solo el último cuenta (`countsForRecord`).
 *
 * Lo que distingue un examen de un ejercicio suelto, y dónde vive cada regla:
 *
 *   · Cobertura de lo enseñado: `generate()` rechaza cualquier unidad que no
 *     esté `published` (`ExamSourceUnitNotPublishedError`) — examinar de
 *     contenido que el alumno no ha visto es el motivo más habitual de
 *     reclamación.
 *   · Dificultad repartida: `skillDistribution` tiene que sumar 100 %
 *     (`ExamSkillDistributionInvalidError`); por defecto, a partes iguales
 *     entre comprensión lectora, oral, expresión escrita y gramática/léxico,
 *     como los exámenes oficiales — el reparto en sí lo calcula el manejador
 *     del comando, este agregado solo comprueba que suma 100.
 *   · Que no repita literalmente lo ya practicado: `generate()` recibe los
 *     ejercicios de práctica de las unidades de origen y rechaza cualquier
 *     ítem cuyo `prompt` sea un calco exacto de uno de ellos
 *     (`ExamItemDuplicatesPracticeError`).
 *   · Reproducible para todo un grupo: el mismo `sections` generado una vez
 *     se pasa a `generate()` una vez por alumno del grupo (el manejador del
 *     comando llama a `generate()` en bucle) — todos hacen el mismo examen.
 *
 * `validate()` acepta partir de `submitted` además de `ai_graded`, igual que
 * `Attempt.validate()`: si la corrección automática no está disponible (sin
 * `ANTHROPIC_API_KEY`, o solo ítems de rúbrica sin corrector), el profesor
 * firma igual desde `submitted`, sin quedar bloqueado.
 *
 * Aprobar un `level_exam` valida do PROPONE subir de nivel MCER
 * (`proposedLevelUpgrade`, evento `ExamLevelUpgradeProposed`): nunca lo
 * decide solo, exactamente igual que `PlacementTestFinished` (tarea 8) —
 * ningún caso de uso de esta tarea toca `studentProfiles` a partir de esto.
 */
export class Exam extends AggregateRoot<ExamId> {
  /**
   * Desglose por destreza, derivado de `sections[].result` — no es parte
   * del estado que llega en el constructor: se calcula con
   * `recomputeSkillBreakdown()`, que `grade()` llama tras registrar cada
   * nota, y que también se puede llamar tras `rehydrate()` para leer
   * `skillBreakdown` de un examen ya corregido sin repetir `grade()`.
   */
  private _skillBreakdownCache: Record<string, number> = {};

  private constructor(
    id: ExamId,
    private readonly _schoolId: SchoolId,
    private readonly _kind: ExamKind,
    private readonly _studentProfileId: string,
    private readonly _title: string,
    private readonly _language: string,
    private readonly _level: CefrLevel,
    private readonly _sourceContentUnitIds: readonly string[],
    private readonly _skillDistribution: Readonly<Record<string, number>>,
    private readonly _sections: MutableExamSection[],
    private readonly _durationMinutes: number,
    private readonly _mockFramework: string | null,
    private _status: ExamStatus,
    private _scheduledFor: Date | null,
    private _startedAt: Date | null,
    private _submittedAt: Date | null,
    private _score: number | null,
    private _aiScore: number | null,
    private _aiFeedback: string | null,
    private _aiModel: string | null,
    private _aiCostCents: number,
    private _validatedByMembershipId: string | null,
    private _validatedAt: Date | null,
    private _proposedLevelUpgrade: CefrLevel | null,
    private readonly _createdAt: Date,
  ) {
    super(id);
  }

  /**
   * Genera un examen a partir de unidades ya publicadas.
   *
   * Nace en `scheduled` (el valor por defecto de la columna): `schedule()`
   * es quien fija de verdad la fecha; generar y programar son pasos
   * distintos porque un profesor puede querer revisar el examen generado
   * antes de anunciar cuándo se hace.
   */
  static generate(params: {
    id: ExamId;
    schoolId: SchoolId;
    kind: ExamKind;
    studentProfileId: string;
    title: string;
    language: string;
    level: CefrLevel;
    sourceUnits: readonly ExamSourceUnitRef[];
    skillDistribution: Record<string, number>;
    sections: readonly ExamSection[];
    durationMinutes: number;
    mockFramework?: string | null;
    /** Ejercicios de práctica ya existentes de las unidades de origen: ningún ítem puede calcarlos. */
    practiceExercises?: readonly PracticeExerciseRef[];
    now: Date;
  }): Exam {
    if (params.sourceUnits.length === 0) {
      throw new ExamRequiresSourceUnitsError();
    }
    for (const unit of params.sourceUnits) {
      if (unit.status !== PUBLISHED) {
        throw new ExamSourceUnitNotPublishedError(unit.id, unit.status);
      }
    }

    const sum = Object.values(params.skillDistribution).reduce((acc, v) => acc + v, 0);
    if (Math.round(sum) !== 100) {
      throw new ExamSkillDistributionInvalidError(sum);
    }

    const totalItems = params.sections.reduce((acc, s) => acc + s.items.length, 0);
    if (totalItems === 0) {
      throw new ExamHasNoItemsError();
    }

    if (params.kind === "mock_official" && !params.mockFramework) {
      throw new ExamMockFrameworkRequiredError();
    }

    const practiceExercises = params.practiceExercises ?? [];
    for (const section of params.sections) {
      for (const item of section.items) {
        const duplicate = practiceExercises.find(
          (ex) => ex.type === item.type && JSON.stringify(ex.prompt) === JSON.stringify(item.prompt),
        );
        if (duplicate) {
          throw new ExamItemDuplicatesPracticeError(item.id, item.sourceExerciseId ?? "desconocido");
        }
      }
    }

    const exam = new Exam(
      params.id,
      params.schoolId,
      params.kind,
      params.studentProfileId,
      params.title,
      params.language,
      params.level,
      params.sourceUnits.map((u) => u.id),
      { ...params.skillDistribution },
      params.sections.map((s) => ({ ...s, items: [...s.items] })),
      params.durationMinutes,
      params.mockFramework ?? null,
      ExamStatus.Scheduled,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      params.now,
    );

    exam.record(
      new ExamGenerated({
        examId: params.id.value,
        schoolId: params.schoolId.value,
        kind: params.kind,
        studentProfileId: params.studentProfileId,
        sourceContentUnitIds: exam._sourceContentUnitIds,
      }),
    );
    return exam;
  }

  /** Reconstruye un examen ya persistido. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: ExamId;
    schoolId: SchoolId;
    kind: ExamKind;
    studentProfileId: string;
    title: string;
    language: string;
    level: CefrLevel;
    sourceContentUnitIds: readonly string[];
    skillDistribution: Record<string, number>;
    sections: ExamSection[];
    durationMinutes: number;
    mockFramework: string | null;
    status: ExamStatus;
    scheduledFor: Date | null;
    startedAt: Date | null;
    submittedAt: Date | null;
    score: number | null;
    aiScore: number | null;
    aiFeedback: string | null;
    aiModel: string | null;
    aiCostCents: number;
    validatedByMembershipId: string | null;
    validatedAt: Date | null;
    proposedLevelUpgrade: CefrLevel | null;
    createdAt: Date;
  }): Exam {
    return new Exam(
      props.id,
      props.schoolId,
      props.kind,
      props.studentProfileId,
      props.title,
      props.language,
      props.level,
      [...props.sourceContentUnitIds],
      { ...props.skillDistribution },
      props.sections.map((s) => ({ ...s, items: [...s.items] })),
      props.durationMinutes,
      props.mockFramework,
      props.status,
      props.scheduledFor,
      props.startedAt,
      props.submittedAt,
      props.score,
      props.aiScore,
      props.aiFeedback,
      props.aiModel,
      props.aiCostCents,
      props.validatedByMembershipId,
      props.validatedAt,
      props.proposedLevelUpgrade,
      props.createdAt,
    );
  }

  /** Fija (o cambia) cuándo se administra el examen. No se programa en el pasado. */
  schedule(params: { scheduledFor: Date; now: Date }): void {
    this.assertCanTransition("schedule");
    if (params.scheduledFor.getTime() < params.now.getTime()) {
      throw new ExamScheduledInPastError(params.scheduledFor, params.now);
    }
    this._scheduledFor = params.scheduledFor;
  }

  /** El alumno empieza: arranca el cronómetro. */
  start(params: { now: Date }): void {
    this.assertCanTransition("start");
    this._status = ExamStatus.InProgress;
    this._startedAt = params.now;
    this.record(
      new ExamStarted({ examId: this.id.value, schoolId: this._schoolId.value, studentProfileId: this._studentProfileId }),
    );
  }

  /**
   * El alumno entrega. `responses` trae la respuesta de cada ítem, indexada
   * por su `id` — los ítems sin respuesta quedan con `response: null` (no
   * se fuerza a contestar todo para poder entregar, «aviso al alumno» del
   * tiempo restante es lo que hace la pantalla, no una regla dura aquí).
   */
  submit(params: { responses: Readonly<Record<string, Record<string, unknown>>>; now: Date }): void {
    this.assertCanTransition("submit");
    if (Object.keys(params.responses).length === 0) {
      throw new EmptyExamSubmissionError(this.id.value);
    }

    for (const section of this._sections) {
      section.items.forEach((item, index) => {
        const response = params.responses[item.id];
        if (response !== undefined) {
          section.items[index] = { ...item, response };
        }
      });
    }

    this._status = ExamStatus.Submitted;
    this._submittedAt = params.now;
    this.record(
      new ExamSubmitted({ examId: this.id.value, schoolId: this._schoolId.value, studentProfileId: this._studentProfileId }),
    );
  }

  /**
   * Registra la propuesta de la IA: una nota por ítem (`itemResults`,
   * indexado por `id` — automática o por rúbrica, calculada por el
   * manejador del comando reutilizando `scoreAutomatically`/
   * `WritingCorrectorPort`, exactamente igual que `Attempt.gradeWithAi`).
   * Este método agrega esas notas en la nota final y el desglose por
   * destreza: la aritmética es del agregado, el cálculo de cada nota no.
   */
  grade(params: { itemResults: Readonly<Record<string, ExamItemResult>>; now: Date }): void {
    this.assertCanTransition("grade");

    let totalCostCents = 0;
    let lastModel: string | null = null;

    for (const section of this._sections) {
      section.items.forEach((item, index) => {
        const result = params.itemResults[item.id];
        if (!result) return;
        assertValidScore(result.score);

        section.items[index] = { ...item, result };
        totalCostCents += result.costCents;
        if (result.model) lastModel = result.model;
      });
    }

    this.recomputeSkillBreakdown();
    const totalScore = this.sumItemScores();

    this._score = totalScore;
    this._aiScore = totalScore;
    this._aiFeedback = `Corrección propuesta: ${totalScore.toFixed(1)} / ${this.maxScore.toFixed(1)}.`;
    this._aiModel = lastModel;
    this._aiCostCents = totalCostCents;
    this._status = ExamStatus.AiGraded;

    this.record(
      new ExamAiGraded({
        examId: this.id.value,
        schoolId: this._schoolId.value,
        studentProfileId: this._studentProfileId,
        aiScore: totalScore,
      }),
    );
  }

  /** Suma de `result.score` de todos los ítems ya corregidos. */
  private sumItemScores(): number {
    return this._sections.reduce(
      (acc, s) => acc + s.items.reduce((a, i) => a + (i.result?.score ?? 0), 0),
      0,
    );
  }

  /**
   * El profesor firma. Puede partir de `submitted` (sin propuesta de IA,
   * p. ej. sin `ANTHROPIC_API_KEY`) o de `ai_graded` (subiendo o bajando la
   * nota propuesta) — mismo criterio que `Attempt.validate()`.
   *
   * Si el examen es `level_exam` y la nota final alcanza el 70 %, PROPONE
   * subir de nivel MCER (`proposedLevelUpgrade` + `ExamLevelUpgradeProposed`)
   * — nunca lo aplica: la decisión de tocar el nivel declarado del alumno es
   * de un caso de uso futuro, explícito, no de este método.
   */
  validate(params: { score: number; membershipId: string; now: Date }): void {
    this.assertCanTransition("validate");
    assertValidScore(params.score);

    this._score = params.score;
    this._validatedByMembershipId = params.membershipId;
    this._validatedAt = params.now;
    this._status = ExamStatus.TeacherValidated;

    if (this._kind === "level_exam" && this.maxScore > 0 && params.score / this.maxScore >= LEVEL_UPGRADE_PASS_RATIO) {
      const proposed = nextLevel(this._level);
      if (proposed) {
        this._proposedLevelUpgrade = proposed;
        this.record(
          new ExamLevelUpgradeProposed({
            examId: this.id.value,
            schoolId: this._schoolId.value,
            studentProfileId: this._studentProfileId,
            proposedLevel: proposed,
          }),
        );
      }
    }

    this.record(
      new ExamTeacherValidated({
        examId: this.id.value,
        schoolId: this._schoolId.value,
        studentProfileId: this._studentProfileId,
        score: params.score,
        validatedByMembershipId: params.membershipId,
      }),
    );
  }

  private assertCanTransition(action: keyof typeof ALLOWED_FROM): void {
    const allowed = ALLOWED_FROM[action]!;
    if (!allowed.includes(this._status)) {
      throw new InvalidExamStateError(this.id.value, action, this._status);
    }
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  /** La única pregunta que de verdad importa: esta nota, ¿cuenta para el expediente? */
  get countsForRecord(): boolean {
    return this._status === ExamStatus.TeacherValidated;
  }

  get maxScore(): number {
    return this._sections.reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.maxScore, 0), 0);
  }

  /** Desglose por destreza de la ÚLTIMA corrección (`grade()`); vacío si aún no se ha corregido. */
  get skillBreakdown(): Readonly<Record<string, number>> {
    return this._skillBreakdownCache ?? {};
  }

  /** Hasta cuándo dura el examen desde que empezó: la base del «aviso al alumno» del tiempo restante. */
  get deadlineAt(): Date | null {
    if (!this._startedAt) return null;
    return new Date(this._startedAt.getTime() + this._durationMinutes * 60_000);
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get kind(): ExamKind {
    return this._kind;
  }
  get studentProfileId(): string {
    return this._studentProfileId;
  }
  get title(): string {
    return this._title;
  }
  get language(): string {
    return this._language;
  }
  get level(): CefrLevel {
    return this._level;
  }
  get sourceContentUnitIds(): readonly string[] {
    return this._sourceContentUnitIds;
  }
  get skillDistribution(): Readonly<Record<string, number>> {
    return this._skillDistribution;
  }
  get sections(): readonly ExamSection[] {
    return this._sections;
  }
  get durationMinutes(): number {
    return this._durationMinutes;
  }
  get mockFramework(): string | null {
    return this._mockFramework;
  }
  get status(): ExamStatus {
    return this._status;
  }
  get scheduledFor(): Date | null {
    return this._scheduledFor;
  }
  get startedAt(): Date | null {
    return this._startedAt;
  }
  get submittedAt(): Date | null {
    return this._submittedAt;
  }
  get score(): number | null {
    return this._score;
  }
  get aiScore(): number | null {
    return this._aiScore;
  }
  get aiFeedback(): string | null {
    return this._aiFeedback;
  }
  get aiModel(): string | null {
    return this._aiModel;
  }
  get aiCostCents(): number {
    return this._aiCostCents;
  }
  get validatedByMembershipId(): string | null {
    return this._validatedByMembershipId;
  }
  get validatedAt(): Date | null {
    return this._validatedAt;
  }
  get proposedLevelUpgrade(): CefrLevel | null {
    return this._proposedLevelUpgrade;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  /** Recalcula el desglose por destreza a partir de los resultados ya guardados en `sections` — para cuando se rehidrata un examen ya `ai_graded`/`teacher_validated` y hace falta leer `skillBreakdown` sin volver a llamar a `grade()`. */
  recomputeSkillBreakdown(): void {
    const skillTotals = new Map<string, { score: number; maxScore: number }>();
    for (const section of this._sections) {
      for (const item of section.items) {
        if (!item.result) continue;
        const skill = skillTotals.get(item.skill) ?? { score: 0, maxScore: 0 };
        skill.score += item.result.score;
        skill.maxScore += item.maxScore;
        skillTotals.set(item.skill, skill);
      }
    }
    this._skillBreakdownCache = Object.fromEntries(
      [...skillTotals].map(([skill, t]) => [skill, t.maxScore > 0 ? t.score / t.maxScore : 0]),
    );
  }
}
