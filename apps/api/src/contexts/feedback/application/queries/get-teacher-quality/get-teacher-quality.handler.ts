import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  FEEDBACK_READ_MODEL,
  type FeedbackReadModel,
  type TeacherQualityRow,
} from "../../ports/feedback-read-model.port.js";

export class GetTeacherQualityQuery extends Query<TeacherQualityRow[]> {
  constructor(readonly props: { from: string; to: string }) {
    super();
  }
}

@QueryHandler(GetTeacherQualityQuery)
export class GetTeacherQualityHandler implements IQueryHandler<GetTeacherQualityQuery> {
  constructor(@Inject(FEEDBACK_READ_MODEL) private readonly readModel: FeedbackReadModel) {}

  async execute(query: GetTeacherQualityQuery): Promise<TeacherQualityRow[]> {
    return this.readModel.teacherQualityBetween({
      from: new Date(query.props.from),
      to: new Date(query.props.to),
    });
  }
}
