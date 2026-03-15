import { IsOptional, IsArray, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class SaveNotesDto {
  @ApiPropertyOptional({ description: "Vocabulary items" })
  @IsOptional()
  @IsArray()
  vocabulary?: { word: string; definition: string; example: string }[];

  @ApiPropertyOptional({ description: "Corrections" })
  @IsOptional()
  @IsArray()
  corrections?: { error: string; correction: string; context: string }[];

  @ApiPropertyOptional({ description: "Homework text" })
  @IsOptional()
  @IsString()
  homework?: string;

  @ApiPropertyOptional({ description: "Objectives text" })
  @IsOptional()
  @IsString()
  objectives?: string;
}
