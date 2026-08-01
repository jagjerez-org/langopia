import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class ContentUnitId extends Uuid {
  private constructor(value: string) {
    super(value, "unidad didáctica");
  }
  static of(value: string): ContentUnitId {
    return new ContentUnitId(value);
  }
}

export class ExerciseId extends Uuid {
  private constructor(value: string) {
    super(value, "ejercicio");
  }
  static of(value: string): ExerciseId {
    return new ExerciseId(value);
  }
}

export class SrsCardId extends Uuid {
  private constructor(value: string) {
    super(value, "tarjeta de repaso");
  }
  static of(value: string): SrsCardId {
    return new SrsCardId(value);
  }
}

/** Material propio subido por la escuela (tarea 14 de la ola 2). */
export class MaterialId extends Uuid {
  private constructor(value: string) {
    super(value, "material");
  }
  static of(value: string): MaterialId {
    return new MaterialId(value);
  }
}

/**
 * Copia propia del identificador de curso, igual que hace `catalog` con los
 * de `people` (`catalog/domain/model/identifiers.ts`). Learning no importa el
 * `CourseId` de `catalog`: cruzar el tipo ataría este contexto a un cambio en
 * otro. Solo hace falta para comprobar que el nivel de la unidad coincide con
 * el del curso al que se asocia — nunca para consultarlo.
 */
export class CourseId extends Uuid {
  private constructor(value: string) {
    super(value, "curso");
  }
  static of(value: string): CourseId {
    return new CourseId(value);
  }
}
