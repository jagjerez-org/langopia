import { IsString, IsOptional, IsEnum, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AcademyType } from "@langopia/shared/types";

export class CreateAcademyDto {
  @ApiProperty({ example: "My Language Academy" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ enum: AcademyType, default: AcademyType.ACADEMY })
  @IsOptional()
  @IsEnum(AcademyType)
  academyType?: AcademyType;
}
