import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ChurnRisk, type ChurnRiskReason, type ChurnRiskLevel } from "../../../domain/model/churn-risk.vo.js";
import {
  CHURN_RISK_READ_MODEL,
  type ChurnRiskReadModel,
  type StudentChurnRiskSignals,
} from "../../ports/churn-risk-read-model.port.js";

const ATTENDANCE_WINDOW_DAYS = 28;
const RECENT_REVIEW_WINDOW_DAYS = 90;

export type StudentAtRisk = {
  studentId: string;
  name: string;
  level: ChurnRiskLevel;
  score: number;
  reasons: ChurnRiskReason[];
  signals: StudentChurnRiskSignals;
};

export class GetStudentsAtRiskQuery extends Query<StudentAtRisk[]> {}

@QueryHandler(GetStudentsAtRiskQuery)
export class GetStudentsAtRiskHandler implements IQueryHandler<GetStudentsAtRiskQuery> {
  constructor(
    @Inject(CHURN_RISK_READ_MODEL) private readonly readModel: ChurnRiskReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<StudentAtRisk[]> {
    const now = this.clock.now();
    const attendanceFrom = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * 24 * 3_600_000);
    const recentReviewFrom = new Date(now.getTime() - RECENT_REVIEW_WINDOW_DAYS * 24 * 3_600_000);
    const rows = await this.readModel.signals({
      attendanceFrom,
      attendanceTo: now,
      recentReviewFrom,
      now,
    });

    return rows
      .map((signals) => {
        const risk = ChurnRisk.evaluate(signals);
        return {
          studentId: signals.studentId,
          name: signals.name,
          level: risk.level,
          score: risk.score,
          reasons: risk.reasons,
          signals,
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
  }
}
