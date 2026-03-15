import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateRoomDto {
  @ApiProperty({ example: "Conversation Practice" })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: "en", default: "en" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: "Array of slide URLs", example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slides?: string[];

  @ApiPropertyOptional({ example: "2026-03-10T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: "UUID of the lesson to attach" })
  @IsOptional()
  @IsString()
  lessonId?: string;
}
