import { IsString, IsEmail, MaxLength, IsOptional } from "class-validator";

export class InviteTeamMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(50)
  role!: string;

  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
}
