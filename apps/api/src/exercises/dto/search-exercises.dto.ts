import { IsString, IsOptional, IsInt, Min, Max, IsArray, IsNumber, IsIn } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SearchExercisesDto {
  @ApiProperty()
  @IsString()
  query!: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetSkill?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiPropertyOptional({ enum: ["topic", "content"] })
  @IsOptional()
  @IsIn(["topic", "content"])
  mode?: "topic" | "content";

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distanceThreshold?: number;
}
