import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { OnboardingService } from "./onboarding.service.js";
import { CompleteStepDto } from "./dto/complete-step.dto.js";

@ApiTags("Onboarding")
@ApiBearerAuth()
@Controller("academies/:academyId/onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: "Get onboarding progress for user and academy" })
  async getProgress(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
  ) {
    return this.onboardingService.getProgress(user.id, academyId);
  }

  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark an onboarding step as completed" })
  async completeStep(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Body() dto: CompleteStepDto,
  ) {
    return this.onboardingService.completeStep(user.id, academyId, dto.step);
  }
}
