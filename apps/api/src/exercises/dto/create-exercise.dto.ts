import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ExercisePlanItem {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  count!: number;
}

export class CreateExerciseDto {
  @ApiProperty()
  @IsString()
  topic!: string;

  @ApiPropertyOptional({ default: "en" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ default: "B1" })
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  materialContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lessonId?: string;

  @ApiProperty({ type: [ExercisePlanItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExercisePlanItem)
  exercises!: ExercisePlanItem[];
}
