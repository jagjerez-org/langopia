import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { AcademyLanguagesService } from "./academy-languages.service.js";
import { CreateAcademyLanguageDto } from "./dto/create-academy-language.dto.js";
import { UpdateAcademyLanguageDto } from "./dto/update-academy-language.dto.js";

@ApiTags("Academy Languages")
@ApiBearerAuth()
@Controller("academies/:academyId/languages")
@UseGuards(JwtAuthGuard)
export class AcademyLanguagesController {
  constructor(private readonly languagesService: AcademyLanguagesService) {}

  @Get()
  @ApiOperation({ summary: "List all languages for an academy" })
  async list(@Param("academyId") academyId: string) {
    return this.languagesService.list(academyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new language" })
  async create(
    @Param("academyId") academyId: string,
    @Body() dto: CreateAcademyLanguageDto,
  ) {
    return this.languagesService.create(academyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a language" })
  async update(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAcademyLanguageDto,
  ) {
    return this.languagesService.update(academyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a language" })
  async remove(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    await this.languagesService.remove(academyId, id);
  }
}
