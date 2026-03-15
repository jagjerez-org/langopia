import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Room } from "../database/entities/room.entity.js";
import { Transcription } from "../database/entities/transcription.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { ReviewItem } from "../database/entities/review-item.entity.js";
import { UsageModule } from "../usage/usage.module.js";
import { PushNotificationModule } from "../push-notification/push-notification.module.js";
import { PostClassPipelineService } from "./post-class-pipeline.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, Transcription, ClassReport, Student, ChatMessage, ReviewItem]),
    UsageModule,
    PushNotificationModule,
  ],
  providers: [PostClassPipelineService],
  exports: [PostClassPipelineService],
})
export class PostClassPipelineModule {}
