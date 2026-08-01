import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import type { RespondentKind, SurveyKind } from "../model/survey-types.js";

export class InvalidSurveyScoreError extends DomainError {
  readonly code = "invalid_survey_score";
  readonly kind = "invalid_input" as const;

  constructor(kind: SurveyKind, score: number, min: number, max: number) {
    super(`La puntuación de la encuesta ${kind} debe ser un entero entre ${min} y ${max}.`, {
      kind,
      score,
      min,
      max,
    });
  }
}

export class InactiveSurveyError extends DomainError {
  readonly code = "inactive_survey";
  readonly kind = "invariant_violation" as const;

  constructor(surveyId: string) {
    super("Esta encuesta no acepta nuevas respuestas.", { surveyId });
  }
}

export class SurveyAudienceMismatchError extends DomainError {
  readonly code = "survey_audience_mismatch";
  readonly kind = "forbidden" as const;

  constructor(expected: RespondentKind, actual: RespondentKind) {
    super("Esta encuesta no corresponde al tipo de persona que intenta responder.", {
      expected,
      actual,
    });
  }
}

export class SurveySessionRequiredError extends DomainError {
  readonly code = "survey_session_required";
  readonly kind = "invalid_input" as const;

  constructor(surveyId: string) {
    super("Una encuesta post-clase necesita la clase a la que se refiere.", { surveyId });
  }
}

export class SurveyAccessDeniedError extends DomainError {
  readonly code = "survey_access_denied";
  readonly kind = "forbidden" as const;

  constructor(sessionId: string) {
    super("Solo quien asistió a la clase puede responder esta encuesta post-clase.", {
      sessionId,
    });
  }
}

export class MissingRespondentMembershipError extends DomainError {
  readonly code = "missing_respondent_membership";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Responder una encuesta requiere una membresía efectiva.");
  }
}

export class InvalidReviewRatingError extends DomainError {
  readonly code = "invalid_review_rating";
  readonly kind = "invalid_input" as const;

  constructor(rating: number) {
    super("La reseña debe puntuar de 1 a 5.", { rating, min: 1, max: 5 });
  }
}

export class AlreadyAcknowledgedReviewError extends DomainError {
  readonly code = "review_already_acknowledged";
  readonly kind = "conflict" as const;

  constructor(reviewId: string) {
    super("Esta reseña ya estaba marcada como vista.", { reviewId });
  }
}

export class MissingReviewerMembershipError extends DomainError {
  readonly code = "missing_reviewer_membership";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Crear o marcar una reseña requiere una membresía efectiva.");
  }
}
