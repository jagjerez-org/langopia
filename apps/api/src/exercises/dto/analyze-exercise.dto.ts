import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class AnalyzeExerciseDto {
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
}
