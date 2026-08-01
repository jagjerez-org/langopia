import { Command } from "@nestjs/cqrs";

export class StartTranscriptionCommand extends Command<{ transcriptId: string; status: string }> {
  constructor(
    readonly props: {
      sessionId: string;
      language: string;
    },
  ) {
    super();
  }
}
