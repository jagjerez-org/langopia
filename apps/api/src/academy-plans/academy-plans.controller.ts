import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { AcademyPlansService } from "./academy-plans.service.js";
import { CreateAcademyPlanDto } from "./dto/create-academy-plan.dto.js";
import { UpdateAcademyPlanDto } from "./dto/update-academy-plan.dto.js";

@ApiTags("Academy Plans")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class AcademyPlansController {
  constructor(private readonly plansService: AcademyPlansService) {}

  @Get("academies/:academyId/plans")
  @ApiOperation({ summary: "List all plans for academy" })
  async list(@Param("academyId") academyId: string) {
    return this.plansService.list(academyId);
  }

  @Post("academies/:academyId/plans")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a plan" })
  async create(
    @Param("academyId") academyId: string,
    @Body() dto: CreateAcademyPlanDto,
  ) {
    return this.plansService.create(academyId, dto);
  }

  @Get("academies/:academyId/plans/:id")
  @ApiOperation({ summary: "Get plan with subscription count" })
  async findOne(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.plansService.findOne(academyId, id);
  }

  @Patch("academies/:academyId/plans/:id")
  @ApiOperation({ summary: "Update a plan" })
  async update(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAcademyPlanDto,
  ) {
    return this.plansService.update(academyId, id, dto);
  }

  @Patch("academies/:academyId/plans/:id/deactivate")
  @ApiOperation({ summary: "Deactivate a plan" })
  async deactivate(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.plansService.setActive(academyId, id, false);
  }

  @Patch("academies/:academyId/plans/:id/activate")
  @ApiOperation({ summary: "Activate a plan" })
  async activate(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.plansService.setActive(academyId, id, true);
  }

  @Get("public/academy/:slug/plans")
  @ApiOperation({ summary: "Get active plans for academy (public)" })
  async getPublicPlans(@Param("slug") slug: string) {
    return this.plansService.getPublicPlans(slug);
  }
}
