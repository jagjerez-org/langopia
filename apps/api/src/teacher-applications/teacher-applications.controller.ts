import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Academy, User } from "../database/entities/index.js";
import { TeacherApplicationsService } from "./teacher-applications.service.js";
import { SubmitApplicationDto } from "./dto/submit-application.dto.js";
import { ReviewApplicationDto } from "./dto/review-application.dto.js";
import { CreateCustomFieldDto } from "./dto/create-custom-field.dto.js";

@ApiTags("Teacher Applications")
@Controller()
export class TeacherApplicationsController {
  constructor(private readonly applicationsService: TeacherApplicationsService) {}

  // --- Protected endpoints (JwtAuthGuard) ---

  @Get("academies/:academyId/teacher-applications")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List teacher applications" })
  async list(
    @CurrentAcademy() academy: Academy,
    @Query("status") status?: string,
  ) {
    return this.applicationsService.list(academy.id, status);
  }

  @Get("academies/:academyId/teacher-applications/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get application detail" })
  async findOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.applicationsService.findOne(academy.id, id);
  }

  @Patch("academies/:academyId/teacher-applications/:id/review")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Approve or reject an application" })
  async review(
    @CurrentAcademy() academy: Academy,
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.review(academy.id, id, user.id, dto);
  }

  @Get("academies/:academyId/application-fields")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List custom fields for applications" })
  async listCustomFields(@CurrentAcademy() academy: Academy) {
    return this.applicationsService.listCustomFields(academy.id);
  }

  @Post("academies/:academyId/application-fields")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a custom field" })
  async createCustomField(
    @CurrentAcademy() academy: Academy,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.applicationsService.createCustomField(academy.id, dto);
  }

  @Delete("academies/:academyId/application-fields/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a custom field" })
  async removeCustomField(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    await this.applicationsService.removeCustomField(academy.id, id);
  }

  // --- Public endpoints (no guard) ---

  @Post("public/academy/:slug/apply")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Submit a teacher application (public)" })
  async submitPublic(
    @Param("slug") slug: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    return this.applicationsService.submitPublic(slug, dto);
  }

  @Get("public/academy/:slug/application-fields")
  @ApiOperation({ summary: "Get custom fields for application form (public)" })
  async getPublicCustomFields(@Param("slug") slug: string) {
    return this.applicationsService.getPublicCustomFields(slug);
  }
}
