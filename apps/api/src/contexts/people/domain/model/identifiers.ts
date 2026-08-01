import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class StudentId extends Uuid {
  private constructor(v: string) {
    super(v, "alumno");
  }
  static of(v: string): StudentId {
    return new StudentId(v);
  }
}

export class TeacherId extends Uuid {
  private constructor(v: string) {
    super(v, "profesor");
  }
  static of(v: string): TeacherId {
    return new TeacherId(v);
  }
}

export class GuardianId extends Uuid {
  private constructor(v: string) {
    super(v, "tutor");
  }
  static of(v: string): GuardianId {
    return new GuardianId(v);
  }
}

export class LeadId extends Uuid {
  private constructor(v: string) {
    super(v, "candidato");
  }
  static of(v: string): LeadId {
    return new LeadId(v);
  }
}
