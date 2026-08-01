import type { ContentUnit } from "../model/content-unit.aggregate.js";
import type { Exercise } from "../model/exercise.entity.js";
import type { ContentUnitId, ExerciseId } from "../model/identifiers.js";

/** Traducción persistida de una unidad: título, descripción y cuerpo en un `locale`. */
export type ContentUnitTranslation = {
  locale: string;
  title: string;
  description: string;
  body: string;
  /** Cierto si la tradujo la IA y nadie la ha revisado (`content_unit_translations.machine_translated`). */
  machineTranslated?: boolean;
};

/** Lo que hace falta para saber si ya existe una rúbrica de un tipo de ejercicio (`written_production`/`spoken_production`). */
export type RubricRef = { id: string; maxScore: number };

/**
 * Lo que hace falta de un ejercicio para decidir, al fallarlo, si abre
 * tarjeta de repetición espaciada (tarea 9): si entra en el repaso
 * (`srsEnabled`) y su puntuación máxima, para poder traducir la nota del
 * intento a la calificación 0-5 que pide `SrsCard.review()`.
 */
export type ExerciseSrsInfo = { maxScore: number; srsEnabled: boolean };

/**
 * Repositorio del agregado `ContentUnit`, y de los dos vecinos que la tarea 6
 * necesita para poder generar y publicar una unidad de verdad:
 *
 *   · Las traducciones (`content_unit_translations`) no son parte del
 *     agregado —viven fuera de su ciclo de vida, una unidad puede ganar
 *     traducciones nuevas sin que eso sea un cambio de estado— así que se
 *     guardan aparte, con su propio método.
 *   · `findRubricIdByCode` no es un cruce de contexto: `rubrics` es una tabla
 *     de `learning` (`packages/db/src/schema/content.ts`), la misma que ya
 *     usa `assessment` desde SU lado con su propio puerto
 *     (`ExerciseSourcePort`). Aquí solo hace falta el identificador para
 *     poder crear el ejercicio; la rúbrica en sí —sus criterios, su
 *     ponderación— es cosa de quien corrige, no de quien genera.
 */
export interface ContentUnitRepository {
  /** Inserta o actualiza la fila de `content_units` con el estado actual del agregado. */
  save(unit: ContentUnit): Promise<void>;

  /** Añade (o sustituye) la traducción de una unidad para un `locale` dado. */
  saveTranslation(unit: ContentUnit, translation: ContentUnitTranslation): Promise<void>;

  /** Inserta los ejercicios de una unidad, en el orden del array (columna `position`, 1-based). */
  addExercises(unit: ContentUnit, exercises: readonly Exercise[]): Promise<void>;

  /** Reconstruye una unidad ya persistida, con la identidad de sus ejercicios ya cargada. `null` si no existe (o RLS la oculta). */
  findById(id: ContentUnitId): Promise<ContentUnit | null>;

  /** Rúbrica de la escuela activa por su código (p. ej. `mcer-escrita`), o `null` si no existe. */
  findRubricIdByCode(code: string): Promise<RubricRef | null>;

  /** `srsEnabled` y `maxScore` de un ejercicio, o `null` si no existe (o RLS lo oculta). */
  findExerciseSrsInfo(exerciseId: ExerciseId): Promise<ExerciseSrsInfo | null>;
}

export const CONTENT_UNIT_REPOSITORY = Symbol("ContentUnitRepository");
