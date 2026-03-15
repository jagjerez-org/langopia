import { IsString, IsOptional, IsInt, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: "Jane Doe" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "https://example.com/avatar.jpg" })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  dailyGoalMinutes?: number;

  @ApiPropertyOptional({ example: "America/New_York" })
  @IsOptional()
  @IsString()
  timezone?: string;
}
