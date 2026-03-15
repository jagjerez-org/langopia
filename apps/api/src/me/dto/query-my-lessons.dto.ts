import { IsOptional, IsInt, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class QueryMyLessonsDto {
  @ApiPropertyOptional({ description: "Filter by language code" })
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: "Filter by CEFR level" })
  @IsOptional()
  cefrLevel?: string;

  @ApiPropertyOptional({ description: "Filter by lesson status" })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
