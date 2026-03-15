import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  IsEmail,
  Min,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateClassDto {
  @ApiProperty({ example: "English Conversation" })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: "A class about conversational English" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "2026-03-10T10:00:00.000Z" })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ enum: ["individual", "group"], default: "individual" })
  @IsOptional()
  @IsIn(["individual", "group"])
  classType?: string;

  @ApiPropertyOptional({ example: "en", default: "en" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ description: "UUID of the lesson to attach" })
  @IsOptional()
  @IsString()
  lessonId?: string;

  @ApiPropertyOptional({ description: "UUID of the course to attach" })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: "UUID of the teacher (AcademyMember)" })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ description: "External Zoom meeting link" })
  @IsOptional()
  @IsString()
  zoomLink?: string;

  @ApiPropertyOptional({
    description: "Student email addresses to enroll",
    example: ["student@example.com"],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  studentEmails?: string[];

  @ApiPropertyOptional({ example: 60, default: 60, description: "Cancellation deadline in minutes before class" })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationMinutes?: number;
}
