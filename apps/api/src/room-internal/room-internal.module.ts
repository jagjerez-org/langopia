import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Room } from "../database/entities/room.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { RoomNotes } from "../database/entities/room-notes.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { Transcription } from "../database/entities/transcription.entity.js";
import { LiveKitModule } from "../livekit/livekit.module.js";
import { RecordingModule } from "../recording/recording.module.js";
import { PostClassPipelineModule } from "../post-class-pipeline/post-class-pipeline.module.js";
import { RoomInternalController } from "./room-internal.controller.js";
import { RoomInternalService } from "./room-internal.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      Class,
      Student,
      RoomParticipant,
      RoomNotes,
      ChatMessage,
      Transcription,
    ]),
    LiveKitModule,
    RecordingModule,
    PostClassPipelineModule,
  ],
  controllers: [RoomInternalController],
  providers: [RoomInternalService],
})
export class RoomInternalModule {}
