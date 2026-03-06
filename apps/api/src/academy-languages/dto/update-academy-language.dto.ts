import { IsString, MaxLength, IsOptional, IsInt, Min } from "class-validator";

export class UpdateAcademyLanguageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
