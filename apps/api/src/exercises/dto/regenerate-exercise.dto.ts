import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class RegenerateExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customPrompt?: string;
}
