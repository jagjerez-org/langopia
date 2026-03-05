import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class InviteTeacherDto {
  @ApiProperty({ description: "Email of the user to invite as teacher" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
