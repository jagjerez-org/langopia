import {
  Controller,
  Get,
  Post,
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
import { V1RoomsService } from "./v1-rooms.service.js";
import { CreateRoomDto } from "./dto/create-room.dto.js";
import { QueryRoomsDto } from "./dto/query-rooms.dto.js";

@ApiTags("Rooms")
@ApiBearerAuth()
@Controller("v1/rooms")
@UseGuards(ApiKeyGuard)
export class V1RoomsController {
  constructor(private readonly v1RoomsService: V1RoomsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new room" })
  async create(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() dto: CreateRoomDto,
  ) {
    return this.v1RoomsService.create(academy, req.ownerId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List rooms with filters" })
  async findAll(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryRoomsDto,
  ) {
    return this.v1RoomsService.findAll(academy, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get room details with participants" })
  async findOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.v1RoomsService.findOne(academy, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Close/cancel a room" })
  async remove(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.v1RoomsService.remove(academy, id);
  }

  @Get(":id/chat")
  @ApiOperation({ summary: "Get chat history for a room" })
  async getChatHistory(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.v1RoomsService.getChatHistory(academy, id);
  }

  @Get(":id/notes")
  @ApiOperation({ summary: "Get room notes" })
  async getNotes(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.v1RoomsService.getNotes(academy, id);
  }

  @Get(":id/report")
  @ApiOperation({ summary: "Get class report for a room" })
  async getReport(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.v1RoomsService.getReport(academy, id);
  }
}
