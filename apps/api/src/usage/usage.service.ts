import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { User } from "../database/entities/user.entity.js";
import { UsageMetric, PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRepo: Repository<UsageRecord>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  async incrementUsage(
    userId: string,
    academyId: string,
    metric: UsageMetric,
    amount = 1,
  ): Promise<void> {
    const period = this.getCurrentPeriod();

    await this.usageRepo
      .createQueryBuilder()
      .insert()
      .values({ userId, academyId, period, metric, value: amount })
      .orUpdate(["value"], ["userId", "academyId", "period", "metric"])
      .setParameter("value", amount)
      .execute()
      .catch(async () => {
        const existing = await this.usageRepo.findOne({
          where: { userId, academyId, period, metric },
        });
        if (existing) {
          existing.value = Number(existing.value) + amount;
          await this.usageRepo.save(existing);
        } else {
          const record = new UsageRecord();
          record.userId = userId;
          record.academyId = academyId;
          record.period = period;
          record.metric = metric;
          record.value = amount;
          await this.usageRepo.save(record);
        }
      });
  }

  async checkPlanLimit(
    userId: string,
    plan: UserPlan,
    metric: UsageMetric,
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const period = this.getCurrentPeriod();

    const result = await this.usageRepo
      .createQueryBuilder("u")
      .select("COALESCE(SUM(u.value), 0)", "total")
      .where("u.userId = :userId", { userId })
      .andWhere("u.period = :period", { period })
      .andWhere("u.metric = :metric", { metric })
      .getRawOne();

    const current = Number(result?.total ?? 0);
    const limits = PLAN_LIMITS[plan];

    let limit = 0;
    switch (metric) {
      case UsageMetric.ROOMS_CREATED:
        limit = limits.maxRoomsPerMonth;
        break;
      case UsageMetric.CLASS_MINUTES:
        limit = limits.maxClassHoursPerMonth * 60;
        break;
      case UsageMetric.AI_REPORTS:
        limit = limits.maxReportsPerMonth;
        break;
      case UsageMetric.AI_TOKENS:
        limit = limits.maxAiTokensPerMonth;
        break;
      case UsageMetric.TTS_CHARACTERS:
        limit = limits.maxTtsCharactersPerMonth;
        break;
      case UsageMetric.STORAGE_BYTES:
        limit = limits.maxStorageBytes;
        break;
      default:
        limit = 999999;
    }

    return { allowed: current < limit, current, limit };
  }

  async getUsageStats(
    userId: string,
    academyId: string,
    plan: UserPlan,
  ) {
    const period = this.getCurrentPeriod();

    const records = await this.usageRepo.find({
      where: { userId, academyId, period },
    });

    const limits = PLAN_LIMITS[plan];
    const metrics = Object.values(UsageMetric);
    const stats: Record<string, { current: number; limit: number }> = {};

    for (const metric of metrics) {
      const record = records.find((r) => r.metric === metric);
      const current = Number(record?.value ?? 0);

      let limit = 0;
      switch (metric) {
        case UsageMetric.ROOMS_CREATED:
          limit = limits.maxRoomsPerMonth;
          break;
        case UsageMetric.CLASS_MINUTES:
          limit = limits.maxClassHoursPerMonth * 60;
          break;
        case UsageMetric.AI_REPORTS:
          limit = limits.maxReportsPerMonth;
          break;
        case UsageMetric.AI_TOKENS:
          limit = limits.maxAiTokensPerMonth;
          break;
        case UsageMetric.TTS_CHARACTERS:
          limit = limits.maxTtsCharactersPerMonth;
          break;
        case UsageMetric.STORAGE_BYTES:
          limit = limits.maxStorageBytes;
          break;
        default:
          limit = 999999;
      }

      stats[metric] = { current, limit };
    }

    return { period, stats };
  }
}
