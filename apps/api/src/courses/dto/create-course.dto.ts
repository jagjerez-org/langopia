import { IsString, IsOptional, MaxLength, IsNumber } from "class-validator";

export class CreateCourseDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MaxLength(10)
  language!: string;

  @IsString()
  @MaxLength(20)
  cefrLevel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number;
}
