import { IsString, MaxLength, IsOptional, IsInt, Min } from "class-validator";

export class CreateAcademyLevelDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
