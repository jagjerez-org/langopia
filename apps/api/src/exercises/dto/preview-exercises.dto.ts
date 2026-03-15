import { IsOptional, IsString, IsArray, ValidateNested, IsNumber } from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

class ExercisePlanItem {
  @IsString()
  type!: string;

  @IsNumber()
  count!: number;
}

export class PreviewExercisesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ default: "en" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ default: "B1" })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  materialContext?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  mediaItemIds?: string[];

  @ApiPropertyOptional({ type: [ExercisePlanItem] })
  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? JSON.parse(value) : value)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExercisePlanItem)
  exercises?: ExercisePlanItem[];
}
