import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class RespondToSurveyDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string | null;

  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @IsOptional()
  @IsUUID()
  teacherProfileId?: string | null;
}

export class FeedbackPeriodQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class CreateReviewDto {
  @IsIn(["material", "session", "teacher"])
  subject!: "material" | "session" | "teacher";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string | null;

  @IsOptional()
  @IsUUID()
  contentUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @IsOptional()
  @IsUUID()
  teacherProfileId?: string | null;
}
