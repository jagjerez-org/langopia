import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { EmbeddingModule } from "../embedding/embedding.module.js";
import { MediaProcessingModule } from "../media-processing/media-processing.module.js";
import { MediaService } from "./media.service.js";
import { MediaController } from "./media.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaItem, MediaPage, User]),
    AuthModule,
    UsageModule,
    StorageModule,
    EmbeddingModule,
    MediaProcessingModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
