import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/index.js";
import { FinancingsService } from "./financings.service.js";
import { QueryFinancingsDto } from "./dto/query-financings.dto.js";

@ApiTags("Financings")
@ApiBearerAuth()
@Controller("academies/:academyId/financings")
@UseGuards(JwtAuthGuard)
export class FinancingsController {
  constructor(private readonly financingsService: FinancingsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Get financings KPIs overview" })
  async getOverview(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Query() query: QueryFinancingsDto,
  ) {
    return this.financingsService.getOverview(academyId, query);
  }

  @Get("subscriptions")
  @ApiOperation({ summary: "List student subscriptions" })
  async listSubscriptions(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.financingsService.listSubscriptions(
      academyId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get("revenue-chart")
  @ApiOperation({ summary: "Get revenue chart data" })
  async getRevenueChart(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Query("period") period?: string,
  ) {
    return this.financingsService.getRevenueChart(academyId, period ?? "monthly");
  }
}
