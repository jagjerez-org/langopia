import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateAcademyDto {
  @ApiPropertyOptional({ example: "Updated Academy Name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: { language: "en", timezone: "UTC" } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
