import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from "class-validator";
import { Type } from "class-transformer";

class SuggestedLesson {
  @IsString()
  suggestedTitle!: string;

  @IsOptional()
  @IsString()
  matchedLessonId?: string;
}

class ModulePlan {
  @IsString()
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestedLesson)
  lessons!: SuggestedLesson[];
}

class CurrentPlan {
  @IsString()
  suggestedTitle!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePlan)
  modules!: ModulePlan[];
}

export class RefineCourseDto {
  @ValidateNested()
  @Type(() => CurrentPlan)
  currentPlan!: CurrentPlan;

  @IsString()
  @MaxLength(2000)
  userMessage!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cefrLevel?: string;
}
