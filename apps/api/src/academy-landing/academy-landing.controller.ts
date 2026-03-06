import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { AcademyLandingService } from "./academy-landing.service.js";
import { UpdateAcademyLandingDto } from "./dto/update-academy-landing.dto.js";

@ApiTags("Academy Landing")
@ApiBearerAuth()
@Controller("academies/:academyId/landing")
@UseGuards(JwtAuthGuard)
export class AcademyLandingController {
  constructor(private readonly landingService: AcademyLandingService) {}

  @Get()
  @ApiOperation({ summary: "Get landing config (creates default if not exists)" })
  async getLanding(@Param("academyId") academyId: string) {
    return this.landingService.getLanding(academyId);
  }

  @Patch()
  @ApiOperation({ summary: "Update landing config" })
  async updateLanding(
    @Param("academyId") academyId: string,
    @Body() dto: UpdateAcademyLandingDto,
  ) {
    return this.landingService.updateLanding(academyId, dto);
  }
}
