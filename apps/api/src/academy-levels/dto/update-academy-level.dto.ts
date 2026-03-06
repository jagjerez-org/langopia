import { IsString, MaxLength, IsOptional, IsInt, Min } from "class-validator";

export class UpdateAcademyLevelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
