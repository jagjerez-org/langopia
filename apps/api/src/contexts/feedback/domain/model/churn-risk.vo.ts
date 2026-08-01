export const ChurnRiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type ChurnRiskLevel = (typeof ChurnRiskLevel)[keyof typeof ChurnRiskLevel];

export const ChurnRiskReasonSignal = {
  LowAttendance: "low_attendance",
  ConsecutiveAbsences: "consecutive_absences",
  NoRecentEvaluation: "no_recent_evaluation",
  LowProgressRating: "low_progress_rating",
  NegativeRecentReview: "negative_recent_review",
  PastDueInvoice: "past_due_invoice",
  DetractorNps: "detractor_nps",
} as const;

export type ChurnRiskReasonSignal =
  (typeof ChurnRiskReasonSignal)[keyof typeof ChurnRiskReasonSignal];

export type ChurnRiskSignals = {
  /** 0 a 1, últimas cuatro semanas. `null` si no tuvo clases en la ventana. */
  attendanceRateLast4Weeks: number | null;
  consecutiveAbsences: number;
  /** `null` si nunca tuvo valoración. */
  weeksWithoutEvaluation: number | null;
  /** 1 a 5. `null` si nunca tuvo valoración. */
  lastProgressRating: number | null;
  /** 1 a 5. Solo reseñas recientes; `null` si no hay reseña reciente. */
  recentNegativeReviewRating: number | null;
  hasPastDueInvoice: boolean;
  /** 0 a 10. `null` si no respondió NPS. */
  latestNpsScore: number | null;
};

export type ChurnRiskReason = {
  signal: ChurnRiskReasonSignal;
  weight: number;
  message: string;
};

export type ChurnRiskResult = {
  level: ChurnRiskLevel;
  score: number;
  reasons: ChurnRiskReason[];
};

export class ChurnRisk {
  static evaluate(signals: ChurnRiskSignals): ChurnRiskResult {
    const reasons: ChurnRiskReason[] = [];

    if (
      signals.attendanceRateLast4Weeks !== null &&
      signals.attendanceRateLast4Weeks < 0.6
    ) {
      reasons.push({
        signal: ChurnRiskReasonSignal.LowAttendance,
        weight: 3,
        message: "Asistencia de las últimas 4 semanas por debajo del 60%.",
      });
    }

    if (signals.consecutiveAbsences >= 3) {
      reasons.push({
        signal: ChurnRiskReasonSignal.ConsecutiveAbsences,
        weight: 3,
        message: "Acumula 3 o más faltas consecutivas.",
      });
    }

    if (signals.weeksWithoutEvaluation === null || signals.weeksWithoutEvaluation >= 3) {
      reasons.push({
        signal: ChurnRiskReasonSignal.NoRecentEvaluation,
        weight: 2,
        message: "Lleva 3 o más semanas sin valoración de progreso.",
      });
    }

    if (signals.lastProgressRating !== null && signals.lastProgressRating <= 2) {
      reasons.push({
        signal: ChurnRiskReasonSignal.LowProgressRating,
        weight: 2,
        message: "La última valoración de progreso es 2/5 o inferior.",
      });
    }

    if (signals.recentNegativeReviewRating !== null && signals.recentNegativeReviewRating <= 2) {
      reasons.push({
        signal: ChurnRiskReasonSignal.NegativeRecentReview,
        weight: 1,
        message: "Tiene una reseña negativa reciente de 2/5 o inferior.",
      });
    }

    if (signals.hasPastDueInvoice) {
      reasons.push({
        signal: ChurnRiskReasonSignal.PastDueInvoice,
        weight: 2,
        message: "Tiene alguna factura vencida.",
      });
    }

    if (signals.latestNpsScore !== null && signals.latestNpsScore <= 6) {
      reasons.push({
        signal: ChurnRiskReasonSignal.DetractorNps,
        weight: 1,
        message: "La última respuesta NPS es detractora.",
      });
    }

    const score = reasons.reduce((total, reason) => total + reason.weight, 0);
    const level =
      score >= 5 ? ChurnRiskLevel.High : score >= 3 ? ChurnRiskLevel.Medium : ChurnRiskLevel.Low;

    return { level, score, reasons };
  }
}
