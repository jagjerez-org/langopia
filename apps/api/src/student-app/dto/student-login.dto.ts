import { IsEmail, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class StudentLoginDto {
  @ApiProperty({ example: "student@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "securePassword123" })
  @IsString()
  password!: string;

  @ApiProperty({ example: "uuid-academy-id" })
  @IsString()
  academyId!: string;
}
