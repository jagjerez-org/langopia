import { IsString, IsOptional, IsBoolean, MaxLength } from "class-validator";

export class UpdateAcademyLandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  heroTitle?: string;

  @IsOptional()
  @IsString()
  heroDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  showPlans?: boolean;

  @IsOptional()
  @IsBoolean()
  showTeacherApplication?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
