import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Room } from "../database/entities/room.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { UsageMetric } from "@langopia/shared/types";

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
}
