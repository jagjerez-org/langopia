import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AcknowledgeReviewCommand } from "../../application/commands/acknowledge-review/acknowledge-review.command.js";
import { CreateReviewCommand } from "../../application/commands/create-review/create-review.command.js";
import { RespondToSurveyCommand } from "../../application/commands/respond-to-survey/respond-to-survey.command.js";
import { GetNpsQuery } from "../../application/queries/get-nps/get-nps.handler.js";
import { GetStudentsAtRiskQuery } from "../../application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { GetTeacherProductivityQuery } from "../../application/queries/get-teacher-productivity/get-teacher-productivity.handler.js";
import { GetTeacherQualityQuery } from "../../application/queries/get-teacher-quality/get-teacher-quality.handler.js";
import { CreateReviewDto, FeedbackPeriodQueryDto, RespondToSurveyDto } from "./dto/feedback.dto.js";

@Roles("student", "teacher", "guardian")
@Controller("feedback")
export class FeedbackController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post("surveys/:surveyId/responses")
  async respond(@Param("surveyId") surveyId: string, @Body() dto: RespondToSurveyDto) {
    return this.commands.execute(
      new RespondToSurveyCommand({
        surveyId,
        score: dto.score,
        comment: dto.comment ?? null,
        sessionId: dto.sessionId ?? null,
        teacherProfileId: dto.teacherProfileId ?? null,
      }),
    );
  }

  @Roles("owner", "admin")
  @Get("nps")
  async nps(@Query() query: FeedbackPeriodQueryDto) {
    return this.queries.execute(new GetNpsQuery({ from: query.from, to: query.to }));
  }

  @Roles("owner", "admin")
  @Get("teacher-quality")
  async teacherQuality(@Query() query: FeedbackPeriodQueryDto) {
    return this.queries.execute(new GetTeacherQualityQuery({ from: query.from, to: query.to }));
  }

  @Roles("owner", "admin")
  @Get("teacher-productivity")
  async teacherProductivity(@Query() query: FeedbackPeriodQueryDto) {
    return this.queries.execute(new GetTeacherProductivityQuery({ from: query.from, to: query.to }));
  }

  @Roles("owner", "admin")
  @Get("students-at-risk")
  async studentsAtRisk() {
    return this.queries.execute(new GetStudentsAtRiskQuery());
  }

  @Post("reviews")
  async createReview(@Body() dto: CreateReviewDto) {
    return this.commands.execute(
      new CreateReviewCommand({
        subject: dto.subject,
        rating: dto.rating,
        comment: dto.comment ?? null,
        contentUnitId: dto.contentUnitId ?? null,
        sessionId: dto.sessionId ?? null,
        teacherProfileId: dto.teacherProfileId ?? null,
      }),
    );
  }

  @Roles("owner", "admin")
  @Post("reviews/:reviewId/acknowledge")
  @HttpCode(200)
  async acknowledgeReview(@Param("reviewId", ParseUUIDPipe) reviewId: string) {
    return this.commands.execute(new AcknowledgeReviewCommand({ reviewId }));
  }
}
