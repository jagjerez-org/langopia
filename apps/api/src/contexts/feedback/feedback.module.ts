import { Module } from "@nestjs/common";
import { AcknowledgeReviewHandler } from "./application/commands/acknowledge-review/acknowledge-review.handler.js";
import { CreateReviewHandler } from "./application/commands/create-review/create-review.handler.js";
import { RespondToSurveyHandler } from "./application/commands/respond-to-survey/respond-to-survey.handler.js";
import { OnFeedbackClassSessionCompleted } from "./application/event-handlers/on-class-session-completed.handler.js";
import { CHURN_RISK_READ_MODEL } from "./application/ports/churn-risk-read-model.port.js";
import { FEEDBACK_READ_MODEL } from "./application/ports/feedback-read-model.port.js";
import { GetNpsHandler } from "./application/queries/get-nps/get-nps.handler.js";
import { GetStudentsAtRiskHandler } from "./application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { GetTeacherProductivityHandler } from "./application/queries/get-teacher-productivity/get-teacher-productivity.handler.js";
import { GetTeacherQualityHandler } from "./application/queries/get-teacher-quality/get-teacher-quality.handler.js";
import { REVIEW_REPOSITORY } from "./domain/ports/review.repository.port.js";
import { SURVEY_DISPATCH_PORT } from "./domain/ports/survey-dispatch.port.js";
import { SURVEY_REPOSITORY } from "./domain/ports/survey.repository.port.js";
import { FeedbackController } from "./infrastructure/http/feedback.controller.js";
import { DrizzleChurnRiskReadModel } from "./infrastructure/persistence/drizzle-churn-risk-read-model.js";
import { DrizzleFeedbackReadModel } from "./infrastructure/persistence/drizzle-feedback-read-model.js";
import { DrizzleReviewRepository } from "./infrastructure/persistence/drizzle-review.repository.js";
import { DrizzleSurveyDispatchRepository } from "./infrastructure/persistence/drizzle-survey-dispatch.repository.js";
import { DrizzleSurveyRepository } from "./infrastructure/persistence/drizzle-survey.repository.js";

const commandHandlers = [RespondToSurveyHandler, CreateReviewHandler, AcknowledgeReviewHandler];
const queryHandlers = [
  GetNpsHandler,
  GetStudentsAtRiskHandler,
  GetTeacherQualityHandler,
  GetTeacherProductivityHandler,
];
const eventHandlers = [OnFeedbackClassSessionCompleted];

@Module({
  controllers: [FeedbackController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    { provide: SURVEY_REPOSITORY, useClass: DrizzleSurveyRepository },
    { provide: REVIEW_REPOSITORY, useClass: DrizzleReviewRepository },
    { provide: SURVEY_DISPATCH_PORT, useClass: DrizzleSurveyDispatchRepository },
    { provide: CHURN_RISK_READ_MODEL, useClass: DrizzleChurnRiskReadModel },
    { provide: FEEDBACK_READ_MODEL, useClass: DrizzleFeedbackReadModel },
  ],
})
export class FeedbackModule {}
