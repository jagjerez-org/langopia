import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AcademyType } from "@langopia/shared/types";

export class RegisterDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "securePassword123" })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "My Academy" })
  @IsOptional()
  @IsString()
  academyName?: string;

  @ApiPropertyOptional({ enum: AcademyType, default: AcademyType.FREELANCE })
  @IsOptional()
  @IsEnum(AcademyType)
  academyType?: AcademyType;
}
