import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { User } from "../database/entities/user.entity.js";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { UsageMetric, PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

@ApiTags("Usage")
@ApiBearerAuth()
@Controller("v1/usage")
@UseGuards(ApiKeyGuard)
export class UsageStatsController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepo: Repository<UsageRecord>,
  ) {}

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  @Get()
  @ApiOperation({ summary: "Get usage stats and plan limits" })
  @ApiQuery({ name: "period", required: false, description: "Period in YYYY-MM format" })
  async getUsage(
    @CurrentAcademy() academy: Academy,
    @Query("period") periodParam: string | undefined,
    @Req() request: { ownerId: string },
  ) {
    const ownerId = request.ownerId;
    const period = periodParam ?? this.getCurrentPeriod();

    // Get all usage records for this user in the given period
    const records = await this.usageRecordRepo.find({
      where: { userId: ownerId, academyId: academy.id, period },
    });

    const usage: Record<string, number> = {};
    for (const metric of Object.values(UsageMetric)) {
      const record = records.find((r) => r.metric === metric);
      usage[metric] = Number(record?.value ?? 0);
    }

    // Get user plan for limits
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = user?.plan ?? UserPlan.FREE;
    const limits = PLAN_LIMITS[plan];

    return {
      period,
      plan,
      usage,
      limits: {
        maxRoomsPerMonth: limits.maxRoomsPerMonth,
        maxClassHoursPerMonth: limits.maxClassHoursPerMonth,
        maxReportsPerMonth: limits.maxReportsPerMonth,
        maxStudentsPerRoom: limits.maxStudentsPerRoom,
        maxStorageBytes: limits.maxStorageBytes,
        maxAiTokensPerMonth: limits.maxAiTokensPerMonth,
      },
    };
  }
}
