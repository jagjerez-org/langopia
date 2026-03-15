import { IsOptional, IsString, IsInt, Min, Max, IsArray } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  learningLanguage?: string;

  @IsOptional()
  @IsString()
  selfAssessedLevel?: string;

  @IsOptional()
  @IsString()
  learningGoal?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  dailyGoalMinutes?: number;
}
