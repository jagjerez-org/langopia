import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

class PreviewExerciseItem {
  @IsString()
  tempId!: string;

  @IsString()
  type!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  instruction!: string;

  @IsString()
  content!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsString()
  correctAnswer!: string;

  @IsString()
  explanation!: string;

  @IsString()
  cefrLevel!: string;

  @IsString()
  targetSkill!: string;
}

export class RefinePreviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewExerciseItem)
  currentExercises!: PreviewExerciseItem[];

  @IsString()
  @IsNotEmpty()
  userMessage!: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  cefrLevel?: string;

  @IsString()
  @IsOptional()
  materialContext?: string;

  @IsString()
  @IsOptional()
  topic?: string;
}
