import { IsString, IsOptional, IsInt, IsBoolean, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SubmitExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  timeSpentSeconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lessonId?: string;
}
