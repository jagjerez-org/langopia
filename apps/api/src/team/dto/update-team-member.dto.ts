import { IsString, IsOptional, IsBoolean, IsArray, MaxLength } from "class-validator";

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
