import { Module } from "@nestjs/common";
import { FileExtractService } from "./file-extract.service.js";

@Module({
  providers: [FileExtractService],
  exports: [FileExtractService],
})
export class FileExtractModule {}
