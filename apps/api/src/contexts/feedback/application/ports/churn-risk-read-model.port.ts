import type { ChurnRiskSignals } from "../../domain/model/churn-risk.vo.js";

export type StudentChurnRiskSignals = ChurnRiskSignals & {
  studentId: string;
  name: string;
};

export interface ChurnRiskReadModel {
  signals(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    recentReviewFrom: Date;
    now: Date;
  }): Promise<StudentChurnRiskSignals[]>;
}

export const CHURN_RISK_READ_MODEL = Symbol("ChurnRiskReadModel");
