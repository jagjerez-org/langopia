import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionCompleted } from "../../../scheduling/domain/events/class-session.events.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  SURVEY_DISPATCH_PORT,
  type SurveyDispatchPort,
} from "../../domain/ports/survey-dispatch.port.js";
import {
  SURVEY_REPOSITORY,
  type SurveyRepository,
} from "../../domain/ports/survey.repository.port.js";

@EventsHandler(ClassSessionCompleted)
export class OnFeedbackClassSessionCompleted implements IEventHandler<ClassSessionCompleted> {
  constructor(
    @Inject(SURVEY_REPOSITORY) private readonly surveys: SurveyRepository,
    @Inject(SURVEY_DISPATCH_PORT) private readonly dispatch: SurveyDispatchPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnFeedbackClassSessionCompleted.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionCompleted): Promise<void> {
    const data = event.payload();
    const context = await this.uow.read(async () => {
      const survey = await this.surveys.findActiveAutoPostSession();
      if (!survey) return null;
      const respondents = await this.dispatch.attendedRespondents(data.sessionId);
      return { survey, respondents };
    });

    if (!context) {
      this.logger.info(`Clase ${data.sessionId} completada: no hay encuesta post-clase activa.`);
      return;
    }
    if (context.respondents.length === 0) {
      this.logger.info(`Clase ${data.sessionId} completada: sin asistentes, no se envía encuesta.`);
      return;
    }

    for (const respondent of context.respondents) {
      await this.dispatch.sendPostSessionSurvey({
        surveyId: context.survey.id,
        surveyCode: context.survey.code,
        sessionId: data.sessionId,
        respondentMembershipId: respondent.membershipId,
        respondentKind: respondent.respondentKind,
      });
    }
  }
}

