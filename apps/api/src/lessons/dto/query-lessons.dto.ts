import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { LessonStatus } from "@langopia/shared/types";

export class QueryLessonsDto {
  @ApiPropertyOptional({ description: "Filter by language" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "Filter by CEFR level" })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional({ enum: LessonStatus, description: "Filter by status" })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

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
