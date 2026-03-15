import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class BulkExerciseItem {
  @IsString()
  type!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  targetSkill!: string;

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
  language!: string;

  @IsBoolean()
  @IsOptional()
  needsAudio?: boolean;
}

export class BulkSaveExercisesDto {
  @IsString()
  @IsOptional()
  lessonId?: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkExerciseItem)
  exercises!: BulkExerciseItem[];
}
