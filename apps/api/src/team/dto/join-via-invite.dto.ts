import { IsString, IsEmail, MaxLength, MinLength } from "class-validator";

export class JoinViaInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}
