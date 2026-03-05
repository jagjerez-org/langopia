import { IsString, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export class BulkUploadMediaDto {
  @ApiProperty({ enum: VALID_CEFR_LEVELS })
  @IsString()
  @IsIn(VALID_CEFR_LEVELS, {
    message: `cefrLevel is required. Valid values: ${VALID_CEFR_LEVELS.join(", ")}`,
  })
  cefrLevel!: string;
}
