import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TRANSCRIPT_READ_MODEL,
  type TranscriptReadModel,
  type TranscriptView,
} from "../../ports/transcript-read-model.port.js";

export class ListTranscriptsQuery extends Query<TranscriptView[]> {}

@QueryHandler(ListTranscriptsQuery)
export class ListTranscriptsHandler implements IQueryHandler<ListTranscriptsQuery> {
  constructor(@Inject(TRANSCRIPT_READ_MODEL) private readonly readModel: TranscriptReadModel) {}

  execute(): Promise<TranscriptView[]> {
    return this.readModel.listRecent();
  }
}
