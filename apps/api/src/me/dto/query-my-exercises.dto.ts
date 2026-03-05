import { IsOptional, IsInt, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class QueryMyExercisesDto {
  @ApiPropertyOptional({ description: "Filter by language code" })
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: "Filter by CEFR level" })
  @IsOptional()
  cefrLevel?: string;

  @ApiPropertyOptional({ description: "Filter by exercise type" })
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: "Filter by target skill" })
  @IsOptional()
  targetSkill?: string;

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
