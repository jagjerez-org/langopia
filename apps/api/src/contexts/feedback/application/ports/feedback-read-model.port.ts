export type NpsResult = {
  score: number | null;
  respondents: number;
  promoters: number;
  passives: number;
  detractors: number;
};

export type TeacherQualityRow = {
  teacherProfileId: string;
  teacherName: string;
  responses: number;
  averageCsat: number | null;
  negativeReviewsPending: number;
};

export type TeacherProductivitySignals = {
  teacherProfileId: string;
  teacherName: string;
  scheduledHours: number;
  contractedHours: number;
  occupancyRate: number;
  sessionCount: number;
  studentsWithoutEvaluation: number;
  studentsWithoutEvaluationNames: string[];
  averageCsat: number | null;
  csatResponses: number;
  materialReviews: number;
  averageMaterialReview: number | null;
  pendingNegativeMaterialReviews: number;
  lateStartedSessions: number;
  completedSessions: number;
  unsignedCorrectionsOlderThan7Days: number;
};

export interface FeedbackReadModel {
  npsScoresBetween(params: { from: Date; to: Date }): Promise<number[]>;
  teacherQualityBetween(params: { from: Date; to: Date }): Promise<TeacherQualityRow[]>;
  teacherProductivityBetween(params: {
    from: Date;
    to: Date;
    staleEvaluationFrom: Date;
    unsignedCorrectionBefore: Date;
  }): Promise<TeacherProductivitySignals[]>;
}

export const FEEDBACK_READ_MODEL = Symbol("FeedbackReadModel");
