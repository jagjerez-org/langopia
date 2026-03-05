import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateLessonDto {
  @ApiProperty({ description: "Lesson title" })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ description: "CEFR level" })
  @IsNotEmpty()
  @IsString()
  cefrLevel!: string;

  @ApiPropertyOptional({ description: "Language code", default: "en" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: "Lesson description" })
  @IsOptional()
  @IsString()
  description?: string;
}
