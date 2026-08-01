import { SingleValueObject } from "../../../shared/domain/primitives/value-object.js";
import { InvalidSurveyScoreError } from "../errors/feedback.errors.js";
import type { SurveyKind } from "./survey-types.js";

export class Score extends SingleValueObject<number> {
  private constructor(value: number) {
    super(value);
  }

  static forSurveyKind(kind: SurveyKind, value: number): Score {
    const { min, max } = rangeFor(kind);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new InvalidSurveyScoreError(kind, value, min, max);
    }
    return new Score(value);
  }
}

function rangeFor(kind: SurveyKind): { min: number; max: number } {
  if (kind === "nps") return { min: 0, max: 10 };
  return { min: 1, max: 5 };
}

