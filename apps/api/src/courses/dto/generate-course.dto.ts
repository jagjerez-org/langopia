import { IsString, IsOptional, MaxLength } from "class-validator";

export class GenerateCourseDto {
  @IsString()
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cefrLevel?: string;
}
