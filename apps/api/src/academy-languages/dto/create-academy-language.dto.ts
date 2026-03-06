import { IsString, MaxLength, IsOptional, IsInt, Min } from "class-validator";

export class CreateAcademyLanguageDto {
  @IsString()
  @MaxLength(10)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
