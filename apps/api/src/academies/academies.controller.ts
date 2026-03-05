import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { AcademiesService } from "./academies.service.js";
import { CreateAcademyDto } from "./dto/create-academy.dto.js";
import { UpdateAcademyDto } from "./dto/update-academy.dto.js";

@ApiTags("Academies")
@ApiBearerAuth()
@Controller("academies")
@UseGuards(JwtAuthGuard)
export class AcademiesController {
  constructor(private readonly academiesService: AcademiesService) {}

  @Get()
  @ApiOperation({ summary: "List user's academies" })
  async listAcademies(@CurrentUser() user: User) {
    return this.academiesService.listAcademies(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new academy" })
  async createAcademy(
    @CurrentUser() user: User,
    @Body() dto: CreateAcademyDto,
  ) {
    return this.academiesService.createAcademy(user.id, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get academy details" })
  async getAcademy(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.academiesService.getAcademy(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update academy settings" })
  async updateAcademy(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateAcademyDto,
  ) {
    return this.academiesService.updateAcademy(user.id, id, dto);
  }

  @Post(":id/regenerate-key")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Regenerate academy API key (owner only)" })
  async regenerateApiKey(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.academiesService.regenerateApiKey(user.id, id);
  }
}
