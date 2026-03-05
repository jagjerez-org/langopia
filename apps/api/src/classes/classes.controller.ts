import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { ClassesService } from "./classes.service.js";
import { CreateClassDto } from "./dto/create-class.dto.js";
import { UpdateClassDto } from "./dto/update-class.dto.js";
import { QueryClassesDto } from "./dto/query-classes.dto.js";

@ApiTags("Classes")
@ApiBearerAuth()
@Controller("v1/classes")
@UseGuards(ApiKeyGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create/book a class" })
  async create(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() dto: CreateClassDto,
  ) {
    return this.classesService.create(academy, req.ownerId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List classes with filters" })
  async findAll(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryClassesDto,
  ) {
    return this.classesService.findAll(academy, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get class detail" })
  async findOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.classesService.findOne(academy, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a class" })
  async update(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(academy, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a class (only scheduled/confirmed)" })
  async remove(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.classesService.remove(academy, id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a class (with deadline check + emails)" })
  async cancel(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    return this.classesService.cancel(academy, id, body?.reason);
  }
}
