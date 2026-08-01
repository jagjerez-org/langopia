import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class CourseId extends Uuid {
  private constructor(value: string) {
    super(value, "curso");
  }
  static of(value: string): CourseId {
    return new CourseId(value);
  }
}

export class GroupId extends Uuid {
  private constructor(value: string) {
    super(value, "grupo");
  }
  static of(value: string): GroupId {
    return new GroupId(value);
  }
}

export class EnrollmentId extends Uuid {
  private constructor(value: string) {
    super(value, "matrícula");
  }
  static of(value: string): EnrollmentId {
    return new EnrollmentId(value);
  }
}

/**
 * Copia propia del identificador de alumno, igual que hace `scheduling` con
 * el suyo (`domain/model/identifiers.ts`). Catalog no importa el `StudentId`
 * de `people`: cruzar el tipo ataría este contexto a un cambio en otro.
 */
export class StudentId extends Uuid {
  private constructor(value: string) {
    super(value, "alumno");
  }
  static of(value: string): StudentId {
    return new StudentId(value);
  }
}

/** Copia propia del identificador de profesor, por el mismo motivo. */
export class TeacherId extends Uuid {
  private constructor(value: string) {
    super(value, "profesor");
  }
  static of(value: string): TeacherId {
    return new TeacherId(value);
  }
}
