import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { PlacementTestFinished, PlacementTestStarted } from "../events/placement-test.events.js";
import { PlacementBankExhaustedError, PlacementTestAlreadyFinishedError } from "../errors/assessment.errors.js";
import { PlacementTestId } from "./identifiers.js";

/** Orden de la escala MCER: el índice ES el nivel para el algoritmo. */
const LEVEL_ORDER: readonly CefrLevel[] = [
  CefrLevel.A1,
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
  CefrLevel.C2,
];
const START_LEVEL_INDEX = LEVEL_ORDER.indexOf(CefrLevel.B1);

/** Tres aciertos seguidos suben de nivel. */
const LEVEL_UP_STREAK = 3;
/** Dos fallos seguidos bajan de nivel. */
const LEVEL_DOWN_STREAK = 2;
/** Seis preguntas seguidas sin cambiar de nivel: la prueba se da por estable. */
const STABLE_QUESTIONS_TO_FINISH = 6;
/** Tope absoluto, aunque no se estabilice nunca. */
const MAX_QUESTIONS = 30;

/** Progreso del algoritmo de subida/bajada de nivel: global, o de una destreza. */
interface LevelTrack {
  readonly levelIndex: number;
  readonly consecutiveCorrect: number;
  readonly consecutiveIncorrect: number;
}

/** Además del nivel, cuánto se ha visto de esa destreza: la base del desglose final. */
interface SkillTrack extends LevelTrack {
  readonly correctCount: number;
  readonly totalCount: number;
}

/**
 * Aplica una respuesta a una progresión de nivel (global o de una destreza):
 * tres aciertos seguidos suben, dos fallos seguidos bajan, sin salirse de la
 * escala MCER. Es la MISMA regla para el nivel global que para cada destreza
 * por separado — así un alumno puede subir en general y quedarse corto en
 * una destreza concreta, que es justo el problema que resuelve el desglose.
 *
 * Al cambiar de nivel las rachas se reinician: los aciertos/fallos que ya
 * causaron la subida (o la bajada) no cuentan una segunda vez para el nivel
 * siguiente. Si el cambio no procede —no se cumple la racha, o ya se está en
 * el extremo de la escala—, las rachas siguen acumulando tal cual.
 */
function advance(track: LevelTrack, correct: boolean): { track: LevelTrack; changed: boolean } {
  const consecutiveCorrect = correct ? track.consecutiveCorrect + 1 : 0;
  const consecutiveIncorrect = correct ? 0 : track.consecutiveIncorrect + 1;

  let levelIndex = track.levelIndex;
  let changed = false;

  if (consecutiveCorrect >= LEVEL_UP_STREAK && levelIndex < LEVEL_ORDER.length - 1) {
    levelIndex += 1;
    changed = true;
  } else if (consecutiveIncorrect >= LEVEL_DOWN_STREAK && levelIndex > 0) {
    levelIndex -= 1;
    changed = true;
  }

  return {
    changed,
    track: {
      levelIndex,
      consecutiveCorrect: changed ? 0 : consecutiveCorrect,
      consecutiveIncorrect: changed ? 0 : consecutiveIncorrect,
    },
  };
}

/** Un ítem ya respondido dentro de esta prueba: la traza que audita el resultado. */
export interface PlacementAnswerRecord {
  readonly itemId: string;
  readonly skill: string;
  readonly level: CefrLevel;
  readonly correct: boolean;
}

/**
 * Nivel MCER global y desglose por destreza que propone el algoritmo. Es una
 * PROPUESTA (ver cabecera de la clase): no cuenta para el expediente hasta
 * que alguien del equipo la confirma.
 */
export interface PlacementTestResult {
  readonly level: CefrLevel;
  readonly skillLevels: Readonly<Record<string, CefrLevel>>;
  readonly questionsAsked: number;
}

/** Qué pedir al banco de ítems para la siguiente pregunta. `null` si la prueba ya terminó. */
export interface NextPlacementItemCriteria {
  readonly level: CefrLevel;
  readonly skill: string;
  readonly excludeItemIds: readonly string[];
}

/** Snapshot serializable en JSON: la forma que viaja fuera del agregado (ver cabecera de la clase). */
export interface PlacementTestSnapshot {
  id: string;
  schoolId: string;
  studentProfileId: string;
  language: string;
  skills: string[];
  levelIndex: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  stableStreak: number;
  questionsAsked: number;
  history: PlacementAnswerRecord[];
  skillState: Record<string, SkillTrack>;
  finished: boolean;
  result: PlacementTestResult | null;
  startedAt: string;
  finishedAt: string | null;
}

/**
 * Prueba de nivelación adaptativa (Tarea 8 de la ola 2).
 *
 * El algoritmo ES el producto: una prueba adaptativa que elige mal las
 * preguntas da un nivel equivocado con toda la apariencia de rigor. Reglas,
 * verbatim del encargo pedagógico:
 *
 *   · Empieza en B1, el punto medio del rango habitual.
 *   · Tres aciertos seguidos suben de nivel; dos fallos seguidos bajan.
 *   · Termina al estabilizarse en un nivel durante seis preguntas, o a las
 *     30 preguntas.
 *   · El resultado incluye desglose por destreza: la MISMA regla de
 *     subida/bajada se aplica en paralelo a cada destreza por separado
 *     (`grammar`, `vocabulary`, `reading`, `listening`…, las que traiga el
 *     banco), así que un alumno puede acabar con B2 de lectura y A2 de
 *     expresión oral en vez de un único nivel que promedia y esconde la
 *     diferencia — meterlo en un grupo B1 sin más es la causa habitual de
 *     que se dé de baja.
 *
 * SIN PERSISTENCIA PROPIA: el seed de esta ola trae el banco de ítems ya
 * calibrados (`placement_items`), pero ninguna tabla de «prueba en curso» —
 * ni falta que hace crear una para esta tarea. Este agregado es
 * deliberadamente autocontenido y serializable (`toSnapshot()` /
 * `rehydrate()`): la capa HTTP hace viajar el snapshot completo entre
 * `start` y cada `answer`, en vez de reconstruirlo desde una fila. Es la
 * decisión más simple y coherente con el esquema ya construido
 * (`CONTEXTO.md`, regla 7 de trabajo); queda anotada en el informe de la
 * tarea para quien construya la ficha de expediente encima.
 *
 * `finish()` calcula una PROPUESTA, nunca una decisión de expediente: la
 * regla de la ola («la IA propone, el profesor firma») se extiende aquí
 * aunque no haya ningún modelo de por medio —un algoritmo determinista
 * también puede acertar el nivel de forma equivocada—, así que ningún caso
 * de uso futuro debería matricular a un alumno o tocar su nivel declarado a
 * partir de `PlacementTestFinished` sin que alguien del equipo lo confirme
 * antes, con el mismo patrón que `Attempt.validate()`. Esta tarea no
 * construye ese paso de confirmación —no está entre los endpoints pedidos—,
 * pero el resultado queda marcado como propuesta para que no se salte.
 */
export class PlacementTest extends AggregateRoot<PlacementTestId> {
  private constructor(
    id: PlacementTestId,
    private readonly _schoolId: SchoolId,
    private readonly _studentProfileId: string,
    private readonly _language: string,
    private readonly _skills: readonly string[],
    private _levelIndex: number,
    private _consecutiveCorrect: number,
    private _consecutiveIncorrect: number,
    private _stableStreak: number,
    private _questionsAsked: number,
    private readonly _history: PlacementAnswerRecord[],
    private readonly _skillState: Map<string, SkillTrack>,
    private _finished: boolean,
    private _result: PlacementTestResult | null,
    private readonly _startedAt: Date,
    private _finishedAt: Date | null,
  ) {
    super(id);
  }

  /** Empieza una prueba nueva. Arranca en B1, sin ninguna pregunta respondida. */
  static start(params: {
    id: PlacementTestId;
    schoolId: SchoolId;
    studentProfileId: string;
    language: string;
    skills: readonly string[];
    now: Date;
  }): PlacementTest {
    if (params.skills.length === 0) {
      throw new PlacementBankExhaustedError(params.language);
    }

    const test = new PlacementTest(
      params.id,
      params.schoolId,
      params.studentProfileId,
      params.language,
      [...params.skills],
      START_LEVEL_INDEX,
      0,
      0,
      0,
      0,
      [],
      new Map(),
      false,
      null,
      params.now,
      null,
    );

    test.record(
      new PlacementTestStarted({
        placementTestId: params.id.value,
        schoolId: params.schoolId.value,
        studentProfileId: params.studentProfileId,
        language: params.language,
      }),
    );
    return test;
  }

  /**
   * Reconstruye una prueba en curso a partir del snapshot que el cliente
   * devolvió (ver cabecera de la clase: no hay fila de base de datos que
   * leer). No valida ni emite eventos: ya ocurrió.
   */
  static rehydrate(snapshot: PlacementTestSnapshot): PlacementTest {
    return new PlacementTest(
      PlacementTestId.of(snapshot.id),
      SchoolId.of(snapshot.schoolId),
      snapshot.studentProfileId,
      snapshot.language,
      [...snapshot.skills],
      snapshot.levelIndex,
      snapshot.consecutiveCorrect,
      snapshot.consecutiveIncorrect,
      snapshot.stableStreak,
      snapshot.questionsAsked,
      snapshot.history.map((h) => ({ ...h })),
      new Map(Object.entries(snapshot.skillState).map(([skill, track]) => [skill, { ...track }])),
      snapshot.finished,
      snapshot.result,
      new Date(snapshot.startedAt),
      snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
    );
  }

  /** El snapshot serializable que hay que devolver íntegro en la siguiente llamada a `answer()`. */
  toSnapshot(): PlacementTestSnapshot {
    return {
      id: this.id.value,
      schoolId: this._schoolId.value,
      studentProfileId: this._studentProfileId,
      language: this._language,
      skills: [...this._skills],
      levelIndex: this._levelIndex,
      consecutiveCorrect: this._consecutiveCorrect,
      consecutiveIncorrect: this._consecutiveIncorrect,
      stableStreak: this._stableStreak,
      questionsAsked: this._questionsAsked,
      history: this._history.map((h) => ({ ...h })),
      skillState: Object.fromEntries([...this._skillState].map(([skill, track]) => [skill, { ...track }])),
      finished: this._finished,
      result: this._result,
      startedAt: this._startedAt.toISOString(),
      finishedAt: this._finishedAt ? this._finishedAt.toISOString() : null,
    };
  }

  /**
   * Qué pedirle al banco de ítems para la siguiente pregunta: el nivel
   * actual y la destreza que toca por turno (rotación estable entre las
   * destrezas con que se abrió la prueba). `null` si ya terminó.
   */
  nextItemCriteria(): NextPlacementItemCriteria | null {
    if (this._finished) return null;
    return {
      level: this.currentLevel,
      skill: this._skills[this._questionsAsked % this._skills.length]!,
      excludeItemIds: this._history.map((h) => h.itemId),
    };
  }

  /**
   * Registra la respuesta a un ítem ya servido. `itemId`, `skill` y `level`
   * son los que DE VERDAD sirvió el banco —pueden no coincidir con
   * `nextItemCriteria()` si el banco tuvo que relajar el criterio por falta
   * de ítems—, porque el desglose por destreza necesita la destreza real,
   * no la ideal.
   *
   * Aplica la regla de subida/bajada dos veces en paralelo: al nivel global
   * (el que decide el criterio de parada) y al de esta destreza (el que
   * alimenta el desglose final). Si se cumple el criterio de parada —seis
   * preguntas seguidas sin cambiar el nivel global, o treinta preguntas—,
   * termina la prueba en el mismo paso.
   */
  answer(params: { itemId: string; skill: string; level: CefrLevel; correct: boolean; now: Date }): void {
    if (this._finished) {
      throw new PlacementTestAlreadyFinishedError(this.id.value);
    }

    this._questionsAsked += 1;
    this._history.push({
      itemId: params.itemId,
      skill: params.skill,
      level: params.level,
      correct: params.correct,
    });

    const globalStep = advance(
      {
        levelIndex: this._levelIndex,
        consecutiveCorrect: this._consecutiveCorrect,
        consecutiveIncorrect: this._consecutiveIncorrect,
      },
      params.correct,
    );
    this._levelIndex = globalStep.track.levelIndex;
    this._consecutiveCorrect = globalStep.track.consecutiveCorrect;
    this._consecutiveIncorrect = globalStep.track.consecutiveIncorrect;
    this._stableStreak = globalStep.changed ? 0 : this._stableStreak + 1;

    const previousSkillTrack: SkillTrack = this._skillState.get(params.skill) ?? {
      levelIndex: START_LEVEL_INDEX,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      correctCount: 0,
      totalCount: 0,
    };
    const skillStep = advance(previousSkillTrack, params.correct);
    this._skillState.set(params.skill, {
      ...skillStep.track,
      correctCount: previousSkillTrack.correctCount + (params.correct ? 1 : 0),
      totalCount: previousSkillTrack.totalCount + 1,
    });

    if (this._stableStreak >= STABLE_QUESTIONS_TO_FINISH || this._questionsAsked >= MAX_QUESTIONS) {
      this.finish(params.now);
    }
  }

  /**
   * Cierra la prueba y fija el resultado: nivel global y desglose por
   * destreza (solo de las destrezas que de verdad se preguntaron; una
   * prueba corta puede no llegar a tocar todas). Lo llama `answer()` sola
   * al cumplirse el criterio de parada; público por si hiciera falta
   * interrumpir la prueba antes de tiempo (sin endpoint propio todavía: ver
   * el informe de la tarea). Idempotente — llamarlo dos veces no cambia el
   * resultado ya fijado.
   */
  finish(now: Date): void {
    if (this._finished) return;

    const skillLevels: Record<string, CefrLevel> = {};
    for (const [skill, track] of this._skillState) {
      if (track.totalCount > 0) skillLevels[skill] = LEVEL_ORDER[track.levelIndex]!;
    }

    this._result = {
      level: this.currentLevel,
      skillLevels,
      questionsAsked: this._questionsAsked,
    };
    this._finished = true;
    this._finishedAt = now;

    this.record(
      new PlacementTestFinished({
        placementTestId: this.id.value,
        schoolId: this._schoolId.value,
        studentProfileId: this._studentProfileId,
        language: this._language,
        level: this._result.level,
        skillLevels: this._result.skillLevels,
        questionsAsked: this._result.questionsAsked,
      }),
    );
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get studentProfileId(): string {
    return this._studentProfileId;
  }
  get language(): string {
    return this._language;
  }
  get skills(): readonly string[] {
    return this._skills;
  }
  /** El nivel MCER en curso: el que se le pide al banco para la siguiente pregunta. */
  get currentLevel(): CefrLevel {
    return LEVEL_ORDER[this._levelIndex]!;
  }
  get questionsAsked(): number {
    return this._questionsAsked;
  }
  get finished(): boolean {
    return this._finished;
  }
  get result(): PlacementTestResult | null {
    return this._result;
  }
  get history(): readonly PlacementAnswerRecord[] {
    return this._history;
  }
  get startedAt(): Date {
    return this._startedAt;
  }
  get finishedAt(): Date | null {
    return this._finishedAt;
  }
}
