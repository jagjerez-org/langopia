import { IsString, IsNumber, IsOptional, IsBoolean, MaxLength, IsObject, Min } from "class-validator";

export class UpdateAcademyPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  periodicity?: string;

  @IsOptional()
  @IsObject()
  limits?: {
    individualClassesPerPeriod?: number;
    groupClassesPerPeriod?: number;
    classCancellationsPerPeriod?: number;
    classBookingsPerPeriod?: number;
    limitPeriod?: string;
    accessLearningPath?: boolean;
    accessAiChat?: boolean;
    accessGroupClasses?: boolean;
    accessIndividualClasses?: boolean;
  };
}
