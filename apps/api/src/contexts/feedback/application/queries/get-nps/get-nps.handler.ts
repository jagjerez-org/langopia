import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  FEEDBACK_READ_MODEL,
  type FeedbackReadModel,
  type NpsResult,
} from "../../ports/feedback-read-model.port.js";
import { calculateNps } from "./nps-calculator.js";

export class GetNpsQuery extends Query<NpsResult> {
  constructor(readonly props: { from: string; to: string }) {
    super();
  }
}

@QueryHandler(GetNpsQuery)
export class GetNpsHandler implements IQueryHandler<GetNpsQuery> {
  constructor(@Inject(FEEDBACK_READ_MODEL) private readonly readModel: FeedbackReadModel) {}

  async execute(query: GetNpsQuery): Promise<NpsResult> {
    const scores = await this.readModel.npsScoresBetween({
      from: new Date(query.props.from),
      to: new Date(query.props.to),
    });
    return calculateNps(scores);
  }
}
