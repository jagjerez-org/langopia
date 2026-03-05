import { IsOptional, IsString, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { LessonStatus } from "@langopia/shared/types";

export class UpdateLessonDto {
  @ApiPropertyOptional({ description: "Lesson title" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "Lesson description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: LessonStatus, description: "Lesson status" })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;
}
