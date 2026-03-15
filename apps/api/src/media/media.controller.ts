import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import type { Academy } from "../database/entities/academy.entity.js";
import { MediaService } from "./media.service.js";
import { UploadMediaDto } from "./dto/upload-media.dto.js";
import { QueryMediaDto } from "./dto/query-media.dto.js";
import { UpdateMediaDto } from "./dto/update-media.dto.js";
import { SearchMediaDto } from "./dto/search-media.dto.js";
import { BulkUploadMediaDto } from "./dto/bulk-upload-media.dto.js";

@ApiTags("media")
@ApiBearerAuth()
@Controller("v1/media")
@UseGuards(ApiKeyGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload single media file" })
  async upload(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadMediaDto,
  ) {
    return this.mediaService.uploadSingle(
      academy.id,
      req.ownerId,
      file,
      body.cefrLevel,
      body.tags,
    );
  }

  @Get()
  @ApiOperation({ summary: "List media items" })
  async list(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryMediaDto,
  ) {
    return this.mediaService.listMedia(academy.id, {
      search: query.search,
      mimeType: query.mimeType,
      status: query.status,
      tags: query.tags,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post("search")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Semantic search for media items" })
  async search(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: SearchMediaDto,
  ) {
    return this.mediaService.searchMedia(academy.id, req.ownerId, {
      query: body.query,
      limit: body.limit,
      mimeType: body.mimeType,
      tags: body.tags,
    });
  }

  @Post("bulk")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor("files", 20))
  @ApiOperation({ summary: "Upload multiple media files (max 20)" })
  async bulkUpload(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: BulkUploadMediaDto,
  ) {
    return this.mediaService.uploadBulk(
      academy.id,
      req.ownerId,
      files,
      body.cefrLevel,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get media item with pages" })
  async getOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.mediaService.getMediaItem(id, academy.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit media item metadata" })
  async update(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() body: UpdateMediaDto,
  ) {
    return this.mediaService.updateMediaItem(id, academy.id, {
      tags: body.tags,
      detectedTopic: body.detectedTopic,
      detectedCefrLevel: body.detectedCefrLevel,
      detectedLanguage: body.detectedLanguage,
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete media item" })
  async remove(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Param("id") id: string,
  ) {
    return this.mediaService.deleteMediaItem(
      id,
      academy.id,
      req.ownerId,
    );
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retry failed media analysis" })
  async retryAnalysis(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.mediaService.retryAnalysis(id, academy.id);
  }
}
