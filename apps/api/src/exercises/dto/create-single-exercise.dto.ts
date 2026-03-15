import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ExerciseType, TargetSkill } from "@langopia/shared/types";

export class CreateSingleExerciseDto {
  @ApiProperty({ description: "How to create: 'prompt' (AI) or 'manual'" })
  @IsString()
  mode!: "prompt" | "manual";

  // ─── Prompt mode fields ───────────────────────────────
  @ApiPropertyOptional({ description: "Prompt describing the exercise to generate (required for prompt mode)" })
  @IsOptional()
  @IsString()
  prompt?: string;

  // ─── Shared fields ────────────────────────────────────
  @ApiProperty()
  @IsString()
  language!: string;

  @ApiProperty()
  @IsString()
  cefrLevel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ enum: ExerciseType })
  @IsOptional()
  @IsEnum(ExerciseType)
  type?: ExerciseType;

  @ApiPropertyOptional({ enum: TargetSkill })
  @IsOptional()
  @IsEnum(TargetSkill)
  targetSkill?: TargetSkill;

  // ─── Manual mode fields ───────────────────────────────
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
