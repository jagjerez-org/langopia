import { IsOptional, IsString, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class QueryCoursesDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
