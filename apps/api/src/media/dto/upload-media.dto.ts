import { IsString, IsOptional, IsArray, IsIn } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export class UploadMediaDto {
  @ApiProperty({ enum: VALID_CEFR_LEVELS })
  @IsString()
  @IsIn(VALID_CEFR_LEVELS, {
    message: `cefrLevel is required. Valid values: ${VALID_CEFR_LEVELS.join(", ")}`,
  })
  cefrLevel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tags?: string;
}
