import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Room } from "../database/entities/room.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { RoomNotes } from "../database/entities/room-notes.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { LiveKitModule } from "../livekit/livekit.module.js";
import { V1RoomsController } from "./v1-rooms.controller.js";
import { V1RoomsService } from "./v1-rooms.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      RoomParticipant,
      RoomNotes,
      ChatMessage,
      ClassReport,
      Lesson,
      User,
    ]),
    AuthModule,
    UsageModule,
    LiveKitModule,
  ],
  controllers: [V1RoomsController],
  providers: [V1RoomsService],
  exports: [V1RoomsService],
})
export class V1RoomsModule {}
