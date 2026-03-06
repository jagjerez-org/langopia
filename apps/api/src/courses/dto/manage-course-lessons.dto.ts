import { IsArray, IsUUID, IsInt, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class CourseLessonItem {
  @IsUUID()
  lessonId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ManageCourseLessonsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseLessonItem)
  lessons!: CourseLessonItem[];
}
