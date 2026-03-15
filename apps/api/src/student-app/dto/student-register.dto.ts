import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class StudentRegisterDto {
  @ApiProperty({ example: "student@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "securePassword123" })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "uuid-academy-id" })
  @IsString()
  academyId!: string;
}
