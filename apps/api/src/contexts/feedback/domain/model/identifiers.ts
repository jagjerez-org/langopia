import { Uuid } from "../../../shared/domain/primitives/uuid.js";

export class SurveyId extends Uuid {
  private constructor(value: string) {
    super(value, "encuesta");
  }
  static of(value: string): SurveyId {
    return new SurveyId(value);
  }
}

export class ResponseId extends Uuid {
  private constructor(value: string) {
    super(value, "respuesta de encuesta");
  }
  static of(value: string): ResponseId {
    return new ResponseId(value);
  }
}

export class SessionId extends Uuid {
  private constructor(value: string) {
    super(value, "clase");
  }
  static of(value: string): SessionId {
    return new SessionId(value);
  }
}

export class TeacherProfileId extends Uuid {
  private constructor(value: string) {
    super(value, "profesor");
  }
  static of(value: string): TeacherProfileId {
    return new TeacherProfileId(value);
  }
}

export class ReviewId extends Uuid {
  private constructor(value: string) {
    super(value, "reseña");
  }
  static of(value: string): ReviewId {
    return new ReviewId(value);
  }
}

export class ContentUnitId extends Uuid {
  private constructor(value: string) {
    super(value, "unidad de contenido");
  }
  static of(value: string): ContentUnitId {
    return new ContentUnitId(value);
  }
}
