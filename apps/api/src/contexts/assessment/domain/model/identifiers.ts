import { Uuid } from "../../../shared/domain/primitives/uuid.js";

/** Identificador de una valoración (una fila de `evaluations`). */
export class EvaluationId extends Uuid {
  private constructor(value: string) {
    super(value, "valoración");
  }
  static of(value: string): EvaluationId {
    return new EvaluationId(value);
  }
}

export class TeacherId extends Uuid {
  private constructor(value: string) {
    super(value, "profesor");
  }
  static of(value: string): TeacherId {
    return new TeacherId(value);
  }
}

export class StudentId extends Uuid {
  private constructor(value: string) {
    super(value, "alumno");
  }
  static of(value: string): StudentId {
    return new StudentId(value);
  }
}

/** Identificador de un intento (una fila de `attempts`). */
export class AttemptId extends Uuid {
  private constructor(value: string) {
    super(value, "intento");
  }
  static of(value: string): AttemptId {
    return new AttemptId(value);
  }
}

/**
 * Copia propia del identificador de ejercicio, igual que hace `learning` con
 * el `CourseId` de `catalog` (`learning/domain/model/identifiers.ts`).
 * Assessment no importa el `ExerciseId` de `learning`: cruzar el tipo ataría
 * este contexto a un cambio en otro. Solo hace falta para pedir, vía
 * `ExerciseSourcePort`, los datos de corrección de ese ejercicio — nunca para
 * cargar su agregado.
 */
export class ExerciseId extends Uuid {
  private constructor(value: string) {
    super(value, "ejercicio");
  }
  static of(value: string): ExerciseId {
    return new ExerciseId(value);
  }
}

/** Identificador de una prueba de nivelación (Tarea 8 de la ola 2). */
export class PlacementTestId extends Uuid {
  private constructor(value: string) {
    super(value, "prueba de nivelación");
  }
  static of(value: string): PlacementTestId {
    return new PlacementTestId(value);
  }
}

/** Identificador de un examen (una fila de `assessments`, Tarea 15 de la ola 2). */
export class ExamId extends Uuid {
  private constructor(value: string) {
    super(value, "examen");
  }
  static of(value: string): ExamId {
    return new ExamId(value);
  }
}

/**
 * Copia propia del identificador de unidad didáctica, igual que hace
 * `ExerciseId` de arriba: assessment no importa el `ContentUnitId` de
 * `learning`. Solo hace falta para pedir, vía `ExerciseSourcePort`, los datos
 * de una unidad de la que examinar — nunca para cargar su agregado.
 */
export class ContentUnitId extends Uuid {
  private constructor(value: string) {
    super(value, "unidad didáctica");
  }
  static of(value: string): ContentUnitId {
    return new ContentUnitId(value);
  }
}
