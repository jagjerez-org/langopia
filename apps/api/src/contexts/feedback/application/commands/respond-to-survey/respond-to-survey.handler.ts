import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import {
  MissingRespondentMembershipError,
  SurveyAccessDeniedError,
} from "../../../domain/errors/feedback.errors.js";
import {
  SURVEY_DISPATCH_PORT,
  type SurveyDispatchPort,
} from "../../../domain/ports/survey-dispatch.port.js";
import {
  SURVEY_REPOSITORY,
  type SurveyRepository,
} from "../../../domain/ports/survey.repository.port.js";
import { ResponseId, SessionId, SurveyId, TeacherProfileId } from "../../../domain/model/identifiers.js";
import { Score } from "../../../domain/model/score.vo.js";
import type { RespondentKind } from "../../../domain/model/survey-types.js";
import { RespondToSurveyCommand } from "./respond-to-survey.command.js";

@CommandHandler(RespondToSurveyCommand)
export class RespondToSurveyHandler implements ICommandHandler<RespondToSurveyCommand> {
  constructor(
    @Inject(SURVEY_REPOSITORY) private readonly surveys: SurveyRepository,
    @Inject(SURVEY_DISPATCH_PORT) private readonly dispatch: SurveyDispatchPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RespondToSurveyCommand): Promise<{ responseId: string; replaced: boolean }> {
    const membershipId = this.tenant.membershipId();
    if (!membershipId) throw new MissingRespondentMembershipError();

    const respondentKind = this.respondentKind();
    const sessionId = command.props.sessionId ? SessionId.of(command.props.sessionId) : null;

    return this.uow.execute(async () => {
      const survey = await this.surveys.findByIdForRespondent({
        surveyId: SurveyId.of(command.props.surveyId),
        respondentMembershipId: MembershipId.of(membershipId),
        sessionId,
      });
      if (!survey) throw new NotFoundError("encuesta", command.props.surveyId);

      if (survey.kind === "post_session") {
        if (!sessionId) throw new SurveyAccessDeniedError("");
        const allowed = await this.dispatch.canRespondToSession({
          respondentMembershipId: membershipId,
          respondentKind,
          sessionId: sessionId.value,
        });
        if (!allowed) throw new SurveyAccessDeniedError(sessionId.value);
      }

      const result = survey.respond({
        responseId: ResponseId.of(this.ids.generate()),
        respondentMembershipId: MembershipId.of(membershipId),
        respondentKind,
        score: Score.forSurveyKind(survey.kind, command.props.score),
        comment: command.props.comment ?? null,
        sessionId,
        teacherProfileId: command.props.teacherProfileId
          ? TeacherProfileId.of(command.props.teacherProfileId)
          : null,
        submittedAt: this.clock.now(),
      });

      await this.surveys.save(survey);
      return { responseId: result.response.id.value, replaced: result.replaced };
    });
  }

  private respondentKind(): RespondentKind {
    if (this.tenant.has("student")) return "student";
    if (this.tenant.has("teacher")) return "teacher";
    return "guardian";
  }
}

