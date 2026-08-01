import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class SessionId extends Uuid {
  private constructor(value: string) {
    super(value, "clase");
  }
  static of(value: string): SessionId {
    return new SessionId(value);
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

/** Identificador de una entrada de asistencia (una fila de `attendance`). */
export class AttendanceId extends Uuid {
  private constructor(value: string) {
    super(value, "asistencia");
  }
  static of(value: string): AttendanceId {
    return new AttendanceId(value);
  }
}
