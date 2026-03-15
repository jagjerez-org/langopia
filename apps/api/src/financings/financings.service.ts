import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StudentSubscription, AcademyPlan, Student } from "../database/entities/index.js";
import { StudentSubscriptionStatus } from "@langopia/shared/types";
import { QueryFinancingsDto } from "./dto/query-financings.dto.js";

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class FinancingsService {
  constructor(
    @InjectRepository(StudentSubscription)
    private readonly subscriptionRepo: Repository<StudentSubscription>,
    @InjectRepository(AcademyPlan)
    private readonly academyPlanRepo: Repository<AcademyPlan>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  async getOverview(academyId: string, query: QueryFinancingsDto) {
    const periodType = query.period ?? "monthly";
    const { current, previous } = this.getPeriodRanges(periodType);

    // Revenue for current period
    const currentRevenue = await this.calculateRevenue(academyId, current, query.academyPlanId);
    const previousRevenue = await this.calculateRevenue(academyId, previous, query.academyPlanId);

    // Subscription counts
    const now = new Date();

    const activeCurrentCount = await this.countSubscriptions(
      academyId,
      StudentSubscriptionStatus.ACTIVE,
      now,
      query.academyPlanId,
    );
    const activePreviousCount = await this.countSubscriptionsByRange(
      academyId,
      StudentSubscriptionStatus.ACTIVE,
      previous,
      query.academyPlanId,
    );

    const inactiveCurrentCount = await this.countInactiveSubscriptions(
      academyId,
      now,
      query.academyPlanId,
    );
    const inactivePreviousCount = await this.countInactiveSubscriptionsByRange(
      academyId,
      previous,
      query.academyPlanId,
    );

    const pastDueCurrentCount = await this.countSubscriptions(
      academyId,
      StudentSubscriptionStatus.PAST_DUE,
      now,
      query.academyPlanId,
    );
    const pastDuePreviousCount = await this.countSubscriptionsByRange(
      academyId,
      StudentSubscriptionStatus.PAST_DUE,
      previous,
      query.academyPlanId,
    );

    // By plan breakdown
    const plans = await this.academyPlanRepo.find({ where: { academyId } });
    const byPlan = await Promise.all(
      plans.map(async (plan) => {
        const planRevenue = await this.calculateRevenue(academyId, current, plan.id);
        const planActiveCount = await this.countSubscriptions(
          academyId,
          StudentSubscriptionStatus.ACTIVE,
          now,
          plan.id,
        );
        const planInactiveCount = await this.countInactiveSubscriptions(
          academyId,
          now,
          plan.id,
        );
        const planPastDueCount = await this.countSubscriptions(
          academyId,
          StudentSubscriptionStatus.PAST_DUE,
          now,
          plan.id,
        );

        return {
          planId: plan.id,
          planName: plan.name,
          revenue: planRevenue,
          activeCount: planActiveCount,
          inactiveCount: planInactiveCount,
          pastDueCount: planPastDueCount,
        };
      }),
    );

    return {
      period: {
        type: periodType,
        start: current.start.toISOString(),
        end: current.end.toISOString(),
      },
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        changePercent: this.calcChangePercent(currentRevenue, previousRevenue),
      },
      subscriptions: {
        active: {
          current: activeCurrentCount,
          previous: activePreviousCount,
          changePercent: this.calcChangePercent(activeCurrentCount, activePreviousCount),
        },
        inactive: {
          current: inactiveCurrentCount,
          previous: inactivePreviousCount,
          changePercent: this.calcChangePercent(inactiveCurrentCount, inactivePreviousCount),
        },
        pastDue: {
          current: pastDueCurrentCount,
          previous: pastDuePreviousCount,
          changePercent: this.calcChangePercent(pastDueCurrentCount, pastDuePreviousCount),
        },
      },
      byPlan,
    };
  }

  async listSubscriptions(academyId: string, limit: number, offset: number) {
    const [data, total] = await this.subscriptionRepo.findAndCount({
      where: { academyId },
      relations: ["student", "academyPlan"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    return {
      data: data.map((s) => ({
        id: s.id,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelledAt: s.cancelledAt,
        createdAt: s.createdAt,
        student: s.student
          ? {
              id: s.student.id,
              email: s.student.email,
              name: s.student.name,
            }
          : null,
        academyPlan: s.academyPlan
          ? {
              id: s.academyPlan.id,
              name: s.academyPlan.name,
              price: s.academyPlan.price,
              currency: s.academyPlan.currency,
              periodicity: s.academyPlan.periodicity,
            }
          : null,
      })),
      total,
      limit,
      offset,
    };
  }

  async getRevenueChart(academyId: string, period: string) {
    if (period === "daily") {
      return this.getDailyRevenueChart(academyId);
    }
    return this.getMonthlyRevenueChart(academyId);
  }

  // ─── Private helpers ──────────────────────────────────────

  private async calculateRevenue(
    academyId: string,
    range: DateRange,
    academyPlanId?: string,
  ): Promise<number> {
    const qb = this.subscriptionRepo
      .createQueryBuilder("sub")
      .innerJoin("sub.academyPlan", "plan")
      .select("COALESCE(SUM(plan.price), 0)", "total")
      .where("sub.academyId = :academyId", { academyId })
      .andWhere("sub.status = :status", { status: StudentSubscriptionStatus.ACTIVE })
      .andWhere("sub.currentPeriodStart <= :end", { end: range.end })
      .andWhere("sub.currentPeriodEnd >= :start", { start: range.start });

    if (academyPlanId) {
      qb.andWhere("sub.academyPlanId = :academyPlanId", { academyPlanId });
    }

    const result = await qb.getRawOne();
    return parseFloat(result?.total ?? "0");
  }

  private async countSubscriptions(
    academyId: string,
    status: StudentSubscriptionStatus,
    asOf: Date,
    academyPlanId?: string,
  ): Promise<number> {
    const qb = this.subscriptionRepo
      .createQueryBuilder("sub")
      .where("sub.academyId = :academyId", { academyId })
      .andWhere("sub.status = :status", { status });

    if (status === StudentSubscriptionStatus.ACTIVE) {
      qb.andWhere("sub.currentPeriodEnd >= :asOf", { asOf });
    }

    if (academyPlanId) {
      qb.andWhere("sub.academyPlanId = :academyPlanId", { academyPlanId });
    }

    return qb.getCount();
  }

  private async countSubscriptionsByRange(
    academyId: string,
    status: StudentSubscriptionStatus,
    range: DateRange,
    academyPlanId?: string,
  ): Promise<number> {
    const qb = this.subscriptionRepo
      .createQueryBuilder("sub")
      .where("sub.academyId = :academyId", { academyId })
      .andWhere("sub.status = :status", { status })
      .andWhere("sub.createdAt <= :end", { end: range.end });

    if (status === StudentSubscriptionStatus.ACTIVE) {
      qb.andWhere("sub.currentPeriodEnd >= :start", { start: range.start });
    }

    if (academyPlanId) {
      qb.andWhere("sub.academyPlanId = :academyPlanId", { academyPlanId });
    }

    return qb.getCount();
  }

  private async countInactiveSubscriptions(
    academyId: string,
    asOf: Date,
    academyPlanId?: string,
  ): Promise<number> {
    const qb = this.subscriptionRepo
      .createQueryBuilder("sub")
      .where("sub.academyId = :academyId", { academyId })
      .andWhere("sub.status IN (:...statuses)", {
        statuses: [StudentSubscriptionStatus.CANCELLED, StudentSubscriptionStatus.EXPIRED],
      });

    if (academyPlanId) {
      qb.andWhere("sub.academyPlanId = :academyPlanId", { academyPlanId });
    }

    return qb.getCount();
  }

  private async countInactiveSubscriptionsByRange(
    academyId: string,
    range: DateRange,
    academyPlanId?: string,
  ): Promise<number> {
    const qb = this.subscriptionRepo
      .createQueryBuilder("sub")
      .where("sub.academyId = :academyId", { academyId })
      .andWhere("sub.status IN (:...statuses)", {
        statuses: [StudentSubscriptionStatus.CANCELLED, StudentSubscriptionStatus.EXPIRED],
      })
      .andWhere("sub.createdAt <= :end", { end: range.end });

    if (academyPlanId) {
      qb.andWhere("sub.academyPlanId = :academyPlanId", { academyPlanId });
    }

    return qb.getCount();
  }

  private async getMonthlyRevenueChart(academyId: string) {
    const points: { date: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const revenue = await this.calculateRevenue(academyId, { start, end });
      points.push({
        date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        revenue,
      });
    }

    return points;
  }

  private async getDailyRevenueChart(academyId: string) {
    const points: { date: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      const revenue = await this.calculateRevenue(academyId, { start, end });
      points.push({
        date: start.toISOString().slice(0, 10),
        revenue,
      });
    }

    return points;
  }

  private getPeriodRanges(periodType: string): { current: DateRange; previous: DateRange } {
    const now = new Date();

    switch (periodType) {
      case "daily": {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        return {
          current: { start: todayStart, end: todayEnd },
          previous: { start: yesterdayStart, end: yesterdayEnd },
        };
      }

      case "quarterly": {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const currentQStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        const currentQEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999);

        let prevQYear = now.getFullYear();
        let prevQuarter = currentQuarter - 1;
        if (prevQuarter < 0) {
          prevQuarter = 3;
          prevQYear -= 1;
        }
        const prevQStart = new Date(prevQYear, prevQuarter * 3, 1);
        const prevQEnd = new Date(prevQYear, prevQuarter * 3 + 3, 0, 23, 59, 59, 999);

        return {
          current: { start: currentQStart, end: currentQEnd },
          previous: { start: prevQStart, end: prevQEnd },
        };
      }

      case "annual": {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return {
          current: { start: yearStart, end: yearEnd },
          previous: { start: prevYearStart, end: prevYearEnd },
        };
      }

      case "monthly":
      default: {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          current: { start: monthStart, end: monthEnd },
          previous: { start: prevMonthStart, end: prevMonthEnd },
        };
      }
    }
  }

  private calcChangePercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }
}
