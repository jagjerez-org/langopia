import { IsString, IsOptional, IsIn } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export class BulkUploadMediaDto {
  @ApiPropertyOptional({ enum: VALID_CEFR_LEVELS })
  @IsOptional()
  @IsString()
  @IsIn(VALID_CEFR_LEVELS, {
    message: `cefrLevel must be one of: ${VALID_CEFR_LEVELS.join(", ")}`,
  })
  cefrLevel?: string;
}
