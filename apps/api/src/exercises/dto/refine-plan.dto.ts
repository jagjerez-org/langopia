import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

class SuggestionItem {
  @IsString()
  type!: string;

  @IsNumber()
  count!: number;

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

class CurrentPlan {
  @IsString()
  detectedTopic!: string;

  @IsString()
  materialSummary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestionItem)
  suggestions!: SuggestionItem[];
}

export class RefinePlanDto {
  @ValidateNested()
  @Type(() => CurrentPlan)
  currentPlan!: CurrentPlan;

  @IsString()
  @IsNotEmpty()
  userMessage!: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  cefrLevel?: string;

  @IsString()
  @IsOptional()
  materialContext?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaItemIds?: string[];
}
