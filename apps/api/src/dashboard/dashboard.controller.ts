import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Room } from "../database/entities/room.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { UsageMetric, PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    @InjectRepository(AcademyMember)
    private readonly memberRepo: Repository<AcademyMember>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(ClassReport)
    private readonly reportRepo: Repository<ClassReport>,
    @InjectRepository(UsageRecord)
    private readonly usageRepo: Repository<UsageRecord>,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Get dashboard overview stats" })
  async getOverview(@CurrentUser() user: User) {
    const userId = user.id;

    // Count academies
    const totalAcademies = await this.memberRepo.count({
      where: { userId },
    });

    // Get academy IDs for this user
    const memberships = await this.memberRepo.find({
      where: { userId },
      select: ["academyId"],
    });
    const academyIds = memberships.map((m) => m.academyId);

    let totalRooms = 0;
    let totalReports = 0;
    let totalClassHours = 0;
    let totalTokens = 0;

    if (academyIds.length > 0) {
      // Count rooms across all academies
      totalRooms = await this.roomRepo
        .createQueryBuilder("room")
        .where("room.academyId IN (:...ids)", { ids: academyIds })
        .getCount();

      // Count reports
      totalReports = await this.reportRepo
        .createQueryBuilder("report")
        .innerJoin("report.room", "room")
        .where("room.academyId IN (:...ids)", { ids: academyIds })
        .getCount();

      // Sum class minutes from usage records
      const minutesResult = await this.usageRepo
        .createQueryBuilder("u")
        .select("COALESCE(SUM(u.value), 0)", "total")
        .where("u.userId = :userId", { userId })
        .andWhere("u.metric = :metric", { metric: UsageMetric.CLASS_MINUTES })
        .getRawOne();
      totalClassHours = Math.round(Number(minutesResult?.total ?? 0) / 60);

      // Sum AI tokens from usage records
      const tokensResult = await this.usageRepo
        .createQueryBuilder("u")
        .select("COALESCE(SUM(u.value), 0)", "total")
        .where("u.userId = :userId", { userId })
        .andWhere("u.metric = :metric", { metric: UsageMetric.AI_TOKENS })
        .getRawOne();
      totalTokens = Number(tokensResult?.total ?? 0);
    }

    return {
      totalAcademies,
      totalRooms,
      totalReports,
      totalClassHours,
      totalTokens,
    };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  @Get("activity")
  @ApiOperation({ summary: "Get recent activity (classes & hours per day)" })
  @ApiQuery({ name: "days", required: false, description: "Number of days (default 7)" })
  async getActivity(
    @CurrentUser() user: User,
    @Query("days") daysParam?: string,
  ) {
    const days = Math.min(Math.max(parseInt(daysParam ?? "7", 10) || 7, 1), 90);

    const memberships = await this.memberRepo.find({
      where: { userId: user.id },
      select: ["academyId"],
    });
    const academyIds = memberships.map((m) => m.academyId);

    // Build date range
    const now = new Date();
    const since = new Date(now);
    since.setDate(now.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    // Generate all dates in range
    const dateMap = new Map<string, { classes: number; hours: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dateMap.set(d.toISOString().slice(0, 10), { classes: 0, hours: 0 });
    }

    if (academyIds.length > 0) {
      const rows = await this.roomRepo
        .createQueryBuilder("room")
        .select("DATE(room.startedAt)", "day")
        .addSelect("COUNT(room.id)", "classes")
        .addSelect(
          `COALESCE(SUM(report.classDuration), SUM(EXTRACT(EPOCH FROM (room.endedAt - room.startedAt)) / 60), 0)`,
          "minutes",
        )
        .leftJoin("class_reports", "report", "report.roomId = room.id")
        .where("room.academyId IN (:...ids)", { ids: academyIds })
        .andWhere("room.startedAt IS NOT NULL")
        .andWhere("room.startedAt >= :since", { since })
        .groupBy("DATE(room.startedAt)")
        .getRawMany();

      for (const row of rows) {
        const dateStr =
          row.day instanceof Date
            ? row.day.toISOString().slice(0, 10)
            : String(row.day).slice(0, 10);
        if (dateMap.has(dateStr)) {
          dateMap.set(dateStr, {
            classes: Number(row.classes),
            hours: parseFloat((Number(row.minutes) / 60).toFixed(1)),
          });
        }
      }
    }

    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      classes: data.classes,
      hours: data.hours,
    }));
  }

  @Get("usage")
  @ApiOperation({ summary: "Get usage stats for an academy (JWT auth)" })
  @ApiQuery({ name: "academyId", required: true, description: "Academy ID" })
  @ApiQuery({ name: "period", required: false, description: "Period in YYYY-MM format" })
  async getUsage(
    @CurrentUser() user: User,
    @Query("academyId") academyId: string,
    @Query("period") periodParam: string | undefined,
  ) {
    // Verify user is a member of this academy
    const membership = await this.memberRepo.findOne({
      where: { userId: user.id, academyId },
    });
    if (!membership) {
      return { period: periodParam ?? this.getCurrentPeriod(), plan: user.plan, usage: {}, limits: PLAN_LIMITS[user.plan] };
    }

    const period = periodParam ?? this.getCurrentPeriod();

    const records = await this.usageRepo.find({
      where: { userId: user.id, academyId, period },
    });

    const usage: Record<string, number> = {};
    for (const metric of Object.values(UsageMetric)) {
      const record = records.find((r) => r.metric === metric);
      usage[metric] = Number(record?.value ?? 0);
    }

    const plan = user.plan ?? UserPlan.FREE;
    const limits = PLAN_LIMITS[plan];

    return {
      period,
      plan,
      usage,
      limits: {
        maxClassesPerMonth: limits.maxClassesPerMonth,
        maxClassHoursPerMonth: limits.maxClassHoursPerMonth,
        maxReportsPerMonth: limits.maxReportsPerMonth,
        maxStudentsPerRoom: limits.maxStudentsPerRoom,
        maxStorageBytes: limits.maxStorageBytes,
        maxAiTokensPerMonth: limits.maxAiTokensPerMonth,
      },
    };
  }
}
