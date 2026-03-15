import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { MediaChunk } from "../database/entities/media-chunk.entity.js";
import { StorageModule } from "../storage/storage.module.js";
import { EmbeddingModule } from "../embedding/embedding.module.js";
import { FileExtractModule } from "../file-extract/file-extract.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { MediaProcessingService } from "./media-processing.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaItem, MediaPage, MediaChunk]),
    StorageModule,
    EmbeddingModule,
    FileExtractModule,
    UsageModule,
  ],
  providers: [MediaProcessingService],
  exports: [MediaProcessingService],
})
export class MediaProcessingModule {}
