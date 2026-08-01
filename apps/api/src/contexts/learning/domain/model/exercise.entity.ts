import { Entity } from "../../../shared/domain/primitives/entity.js";
import {
  AUDIO_EXERCISE_TYPES,
  InvalidExerciseError,
  RUBRIC_EXERCISE_TYPES,
  validateExercise,
  type ExerciseType,
} from "./exercise-schemas.js";
import { ContentUnitId, ExerciseId } from "./identifiers.js";

/**
 * Un ejercicio de una unidad didáctica.
 *
 * Vive fuera de `ContentUnit` (que solo conoce su identidad, vía
 * `addExercise`) porque su invariante —qué forma tiene un `prompt`/`solution`
 * válidos— depende del tipo, no de la unidad: no hace falta cargar la unidad
 * entera para saber si UN ejercicio es coherente.
 *
 * Dos reglas no las comprueba `validateExercise` porque no son ni `prompt` ni
 * `solution`:
 *
 *   · Rúbrica: `written_production` y `spoken_production` no tienen
 *     «correcto» automático. Sin `rubricId` ni `requiresTeacherValidation:
 *     true` no hay quien corrija ni quien firme la nota antes de que cuente
 *     («la IA propone, el profesor firma», regla de la ola 2).
 *   · Audio: `dictation`, `shadowing` y `listening_comprehension` prometen un
 *     `audioRef`. Si la unidad no tiene ningún recurso de audio real, el
 *     `audioRef` no apunta a nada — lo sabe quien construye el ejercicio
 *     (tiene la unidad a la vista), no `Exercise` ni `validateExercise`.
 */
export class Exercise extends Entity<ExerciseId> {
  private constructor(
    id: ExerciseId,
    private readonly _contentUnitId: ContentUnitId,
    private readonly _type: ExerciseType,
    private readonly _prompt: Record<string, unknown>,
    private readonly _solution: Record<string, unknown> | undefined,
    private readonly _rubricId: string | null,
    private readonly _requiresTeacherValidation: boolean,
    private readonly _skill: string | null,
    private readonly _maxScore: number,
    private readonly _srsEnabled: boolean,
  ) {
    super(id);
  }

  static create(params: {
    id: ExerciseId;
    contentUnitId: ContentUnitId;
    type: ExerciseType;
    prompt: Record<string, unknown>;
    solution?: Record<string, unknown>;
    rubricId?: string | null;
    requiresTeacherValidation?: boolean;
    /**
     * Solo importa para los tipos de `AUDIO_EXERCISE_TYPES`: si la unidad a
     * la que va a pertenecer este ejercicio ya tiene un recurso de audio.
     * `Exercise` no conoce `ContentUnit` ni sus `contentAssets` —cruzaría el
     * agregado—, así que quien sí los tiene a la vista (el caso de uso) es
     * quien responde a esta pregunta.
     */
    unitHasAudioAsset?: boolean;
    /**
     * Campos que la tarea 2 no necesitaba (validar `prompt`/`solution` no
     * depende de ellos) pero que `exercises` sí exige para persistir
     * (tarea 6: es quien primero guarda ejercicios de verdad). Opcionales y
     * con valor por defecto para no romper ninguna llamada existente.
     */
    skill?: string | null;
    maxScore?: number;
    srsEnabled?: boolean;
  }): Exercise {
    validateExercise(params.type, params.prompt, params.solution);

    if (RUBRIC_EXERCISE_TYPES.has(params.type)) {
      if (!params.rubricId) {
        throw new InvalidExerciseError(
          params.type,
          "los tipos que se corrigen con rúbrica exigen `rubricId`.",
        );
      }
      if (params.requiresTeacherValidation !== true) {
        throw new InvalidExerciseError(
          params.type,
          "los tipos que se corrigen con rúbrica exigen `requiresTeacherValidation: true`: " +
            "la IA propone, el profesor firma.",
        );
      }
    }

    if (AUDIO_EXERCISE_TYPES.has(params.type) && !params.unitHasAudioAsset) {
      throw new InvalidExerciseError(
        params.type,
        "este tipo necesita `audioRef`, y la unidad no tiene ningún recurso de audio.",
      );
    }

    return new Exercise(
      params.id,
      params.contentUnitId,
      params.type,
      params.prompt,
      params.solution,
      params.rubricId ?? null,
      params.requiresTeacherValidation ?? false,
      params.skill ?? null,
      params.maxScore ?? 1,
      params.srsEnabled ?? false,
    );
  }

  get contentUnitId(): ContentUnitId {
    return this._contentUnitId;
  }
  get type(): ExerciseType {
    return this._type;
  }
  get prompt(): Record<string, unknown> {
    return this._prompt;
  }
  get solution(): Record<string, unknown> | undefined {
    return this._solution;
  }
  get rubricId(): string | null {
    return this._rubricId;
  }
  get requiresTeacherValidation(): boolean {
    return this._requiresTeacherValidation;
  }
  get skill(): string | null {
    return this._skill;
  }
  get maxScore(): number {
    return this._maxScore;
  }
  get srsEnabled(): boolean {
    return this._srsEnabled;
  }
}
