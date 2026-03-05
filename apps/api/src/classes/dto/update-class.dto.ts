import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateClassDto {
  @ApiPropertyOptional({ example: "Updated Class Title" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Updated description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "2026-03-10T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: "UUID of the lesson (null to unset)" })
  @IsOptional()
  @IsString()
  lessonId?: string | null;

  @ApiPropertyOptional({ description: "UUID of the teacher AcademyMember (null to unset)" })
  @IsOptional()
  @IsString()
  teacherId?: string | null;
}
