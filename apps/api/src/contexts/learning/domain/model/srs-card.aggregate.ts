import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InvalidReviewQualityError } from "../errors/learning.errors.js";
import { ExerciseId, SrsCardId } from "./identifiers.js";

/** Facilidad de partida de una tarjeta nueva. SM-2 original: 2,5. */
const DEFAULT_EASE = 2.5;
/** Suelo de la facilidad: por muchos fallos seguidos que encadene, nunca baja de aquí (SM-2 original). */
const MIN_EASE = 1.3;
/** A partir de esta calificación (inclusive) SM-2 considera el repaso un acierto. */
const PASSING_QUALITY = 3;
const MIN_QUALITY = 0;
const MAX_QUALITY = 5;

/**
 * Tarjeta de repetición espaciada de un alumno sobre un ejercicio, con SM-2.
 *
 * Nace cuando el alumno FALLA un ejercicio con `srsEnabled` — no cuando
 * acierta a la primera— (ver el manejador de aplicación, tarea 9: es una
 * decisión suya, no de este agregado). A partir de ahí, cada repaso mueve
 * tres números con una única regla: un acierto alarga el intervalo hasta el
 * próximo repaso (más cuanto más alta sea la racha de aciertos); un fallo
 * reinicia la racha y el intervalo a un día, y suma un lapso; la facilidad
 * (`ease`) se recalcula SIEMPRE con la fórmula original de SM-2 —incluso en
 * un fallo—, pero nunca baja de 1,3: por muchos fallos seguidos, una tarjeta
 * no se vuelve infinitamente más costosa de recordar.
 *
 * `today` (en `create()` y `review()`) es la fecha de calendario
 * (`YYYY-MM-DD`) ya resuelta en la zona horaria de la ESCUELA, no la del
 * proceso ni la de quien mira el navegador — este agregado no sabe qué es una
 * zona horaria, igual que `ContentUnit` no resuelve el nivel del curso al que
 * se asocia: quien llama (el manejador, con su propio puerto) entrega el dato
 * ya resuelto. `dueOn` usa el mismo formato porque es exactamente lo que
 * exige la columna `date` de `srs_cards`.
 */
export class SrsCard extends AggregateRoot<SrsCardId> {
  private constructor(
    id: SrsCardId,
    private readonly _schoolId: SchoolId,
    private readonly _studentProfileId: string,
    private readonly _exerciseId: ExerciseId | null,
    private _ease: number,
    private _intervalDays: number,
    private _repetitions: number,
    private _lapses: number,
    private _dueOn: string,
    private _lastReviewedAt: Date | null,
  ) {
    super(id);
  }

  /**
   * Nace de un fallo. Arranca con los valores por defecto de una tarjeta
   * nueva (facilidad 2,5, intervalo de un día, sin repeticiones ni lapsos) y
   * les aplica de inmediato la calificación de ESE primer repaso a través de
   * `review()`: no hay dos implementaciones del algoritmo, solo una tarjeta
   * que nace ya revisada una vez.
   */
  static create(params: {
    id: SrsCardId;
    schoolId: SchoolId;
    studentProfileId: string;
    exerciseId: ExerciseId;
    quality: number;
    today: string;
    now: Date;
  }): SrsCard {
    const card = new SrsCard(
      params.id,
      params.schoolId,
      params.studentProfileId,
      params.exerciseId,
      DEFAULT_EASE,
      1,
      0,
      0,
      params.today,
      null,
    );
    card.review({ quality: params.quality, today: params.today, now: params.now });
    return card;
  }

  /** Reconstruye desde persistencia. No valida ni recalcula: lo guardado ya pasó por `review()` antes. */
  static rehydrate(params: {
    id: SrsCardId;
    schoolId: SchoolId;
    studentProfileId: string;
    exerciseId: ExerciseId | null;
    ease: number;
    intervalDays: number;
    repetitions: number;
    lapses: number;
    dueOn: string;
    lastReviewedAt: Date | null;
  }): SrsCard {
    return new SrsCard(
      params.id,
      params.schoolId,
      params.studentProfileId,
      params.exerciseId,
      params.ease,
      params.intervalDays,
      params.repetitions,
      params.lapses,
      params.dueOn,
      params.lastReviewedAt,
    );
  }

  /**
   * Registra un repaso, SM-2 clásico: `quality` de 0 (fallo total) a 5
   * (perfecto). El orden importa y reproduce el algoritmo original exacto:
   * el intervalo de un acierto en su tercera repetición o más se calcula con
   * la facilidad ANTERIOR a este repaso, y solo DESPUÉS se actualiza la
   * facilidad con la calificación de este repaso.
   */
  review(params: { quality: number; today: string; now: Date }): void {
    assertValidQuality(params.quality);
    const easeBeforeThisReview = this._ease;

    if (params.quality < PASSING_QUALITY) {
      this._repetitions = 0;
      this._lapses += 1;
      this._intervalDays = 1;
    } else {
      if (this._repetitions === 0) this._intervalDays = 1;
      else if (this._repetitions === 1) this._intervalDays = 6;
      else this._intervalDays = Math.round(this._intervalDays * easeBeforeThisReview);
      this._repetitions += 1;
    }

    this._ease = Math.max(
      MIN_EASE,
      easeBeforeThisReview +
        (0.1 - (5 - params.quality) * (0.08 + (5 - params.quality) * 0.02)),
    );
    this._dueOn = addDays(params.today, this._intervalDays);
    this._lastReviewedAt = params.now;
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get studentProfileId(): string {
    return this._studentProfileId;
  }
  get exerciseId(): ExerciseId | null {
    return this._exerciseId;
  }
  get ease(): number {
    return this._ease;
  }
  get intervalDays(): number {
    return this._intervalDays;
  }
  get repetitions(): number {
    return this._repetitions;
  }
  get lapses(): number {
    return this._lapses;
  }
  get dueOn(): string {
    return this._dueOn;
  }
  get lastReviewedAt(): Date | null {
    return this._lastReviewedAt;
  }
}

function assertValidQuality(quality: number): void {
  if (!Number.isInteger(quality) || quality < MIN_QUALITY || quality > MAX_QUALITY) {
    throw new InvalidReviewQualityError(quality);
  }
}

/**
 * Suma días de calendario a una fecha `YYYY-MM-DD`.
 *
 * Aritmética en UTC a propósito: sumar días con un `Date` en hora local
 * arrastra el huso horario del PROCESO que ejecuta este código, que es
 * justo lo que esta tarea tiene que evitar (la escuela puede estar en
 * cualquier zona horaria, el servidor en otra). Tratando la fecha como un
 * punto fijo en UTC, sumar N días no depende de dónde corre el proceso.
 */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
