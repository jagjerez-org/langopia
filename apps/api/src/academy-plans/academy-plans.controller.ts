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
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/index.js";
import { AcademyPlansService } from "./academy-plans.service.js";
import { CreateAcademyPlanDto } from "./dto/create-academy-plan.dto.js";
import { UpdateAcademyPlanDto } from "./dto/update-academy-plan.dto.js";

@ApiTags("Academy Plans")
@Controller()
export class AcademyPlansController {
  constructor(private readonly plansService: AcademyPlansService) {}

  @Get("academies/:academyId/plans")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List all plans for academy" })
  async list(@CurrentAcademy() academy: Academy) {
    return this.plansService.list(academy.id);
  }

  @Post("academies/:academyId/plans")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a plan" })
  async create(
    @CurrentAcademy() academy: Academy,
    @Body() dto: CreateAcademyPlanDto,
  ) {
    return this.plansService.create(academy.id, dto);
  }

  @Get("academies/:academyId/plans/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get plan with subscription count" })
  async findOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.plansService.findOne(academy.id, id);
  }

  @Patch("academies/:academyId/plans/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update a plan" })
  async update(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: UpdateAcademyPlanDto,
  ) {
    return this.plansService.update(academy.id, id, dto);
  }

  @Patch("academies/:academyId/plans/:id/deactivate")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Deactivate a plan" })
  async deactivate(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.plansService.setActive(academy.id, id, false);
  }

  @Patch("academies/:academyId/plans/:id/activate")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Activate a plan" })
  async activate(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.plansService.setActive(academy.id, id, true);
  }

  @Get("public/academy/:slug/plans")
  @ApiOperation({ summary: "Get active plans for academy (public)" })
  async getPublicPlans(@Param("slug") slug: string) {
    return this.plansService.getPublicPlans(slug);
  }
}
