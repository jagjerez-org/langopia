import { IsString, IsOptional, IsBoolean, IsArray, IsInt, Min, MaxLength } from "class-validator";

export class CreateCustomFieldDto {
  @IsString()
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fieldType?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
