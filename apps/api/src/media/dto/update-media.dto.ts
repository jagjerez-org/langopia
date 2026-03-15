import { IsOptional, IsString, IsArray } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detectedTopic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detectedCefrLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detectedLanguage?: string;
}
