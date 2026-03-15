import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { TTSService } from "./tts.service.js";

@Module({
  imports: [StorageModule],
  providers: [TTSService],
  exports: [TTSService],
})
export class TTSModule {}
