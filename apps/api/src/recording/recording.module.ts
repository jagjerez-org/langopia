import { Module } from "@nestjs/common";
import { RecordingService } from "./recording.service.js";

@Module({
  providers: [RecordingService],
  exports: [RecordingService],
})
export class RecordingModule {}
