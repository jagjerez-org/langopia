import { IsOptional, IsString, IsEnum, IsNumber } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { LearningPathStatus } from "@langopia/shared/types";

export class UpdateLearningPathDto {
  @ApiPropertyOptional({ description: "Learning path title" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "Description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Language code" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "CEFR level" })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional({ description: "Thumbnail URL" })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: "Estimated hours to complete" })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number;

  @ApiPropertyOptional({ enum: LearningPathStatus, description: "Status" })
  @IsOptional()
  @IsEnum(LearningPathStatus)
  status?: LearningPathStatus;
}
