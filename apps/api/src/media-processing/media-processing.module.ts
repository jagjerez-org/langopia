import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { StorageModule } from "../storage/storage.module.js";
import { EmbeddingModule } from "../embedding/embedding.module.js";
import { FileExtractModule } from "../file-extract/file-extract.module.js";
import { MediaProcessingService } from "./media-processing.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaItem, MediaPage]),
    StorageModule,
    EmbeddingModule,
    FileExtractModule,
  ],
  providers: [MediaProcessingService],
  exports: [MediaProcessingService],
})
export class MediaProcessingModule {}
