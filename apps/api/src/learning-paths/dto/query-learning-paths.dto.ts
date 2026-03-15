import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { LearningPathStatus } from "@langopia/shared/types";

export class QueryLearningPathsDto {
  @ApiPropertyOptional({ description: "Filter by language" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "Filter by CEFR level" })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional({ enum: LearningPathStatus, description: "Filter by status" })
  @IsOptional()
  @IsEnum(LearningPathStatus)
  status?: LearningPathStatus;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
