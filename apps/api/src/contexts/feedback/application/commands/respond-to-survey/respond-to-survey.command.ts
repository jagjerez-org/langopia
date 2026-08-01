export class RespondToSurveyCommand {
  constructor(
    readonly props: {
      surveyId: string;
      score: number;
      comment?: string | null;
      sessionId?: string | null;
      teacherProfileId?: string | null;
    },
  ) {}
}

