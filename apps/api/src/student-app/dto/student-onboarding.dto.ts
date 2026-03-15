import { IsString, IsOptional, IsArray, IsInt, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class StudentOnboardingDto {
  @ApiPropertyOptional({ example: "es" })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiPropertyOptional({ example: "en" })
  @IsOptional()
  @IsString()
  learningLanguage?: string;

  @ApiPropertyOptional({ example: "A2" })
  @IsOptional()
  @IsString()
  selfAssessedLevel?: string;

  @ApiPropertyOptional({ example: "work" })
  @IsOptional()
  @IsString()
  learningGoal?: string;

  @ApiPropertyOptional({ example: "professional" })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: ["technology", "music", "travel"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  dailyGoalMinutes?: number;

  @ApiPropertyOptional({ example: "friend" })
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional({ example: "America/New_York" })
  @IsOptional()
  @IsString()
  timezone?: string;
}
