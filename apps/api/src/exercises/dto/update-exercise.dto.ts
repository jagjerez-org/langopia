import { IsOptional, IsString, IsArray } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instruction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

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
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
