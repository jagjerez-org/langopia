import { IsArray, IsUUID, IsInt, IsString, IsOptional, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class CourseLessonItem {
  @IsUUID()
  lessonId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsString()
  moduleTitle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  moduleOrder?: number;
}

export class ManageCourseLessonsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseLessonItem)
  lessons!: CourseLessonItem[];
}
