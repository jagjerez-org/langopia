import { IsNotEmpty, IsOptional, IsString, IsNumber } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateLearningPathDto {
  @ApiProperty({ description: "Learning path title" })
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

  @ApiPropertyOptional({ description: "Learning path description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Thumbnail URL" })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: "Estimated hours to complete" })
  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}
