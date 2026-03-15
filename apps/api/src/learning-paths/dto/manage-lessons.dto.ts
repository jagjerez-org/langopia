import { IsArray, IsOptional, IsString, IsUUID, ArrayMinSize } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AddLessonsDto {
  @ApiPropertyOptional({ description: "Single lesson ID to add", type: String })
  @IsOptional()
  @IsUUID("4")
  lessonId?: string;

  @ApiPropertyOptional({ description: "Array of lesson IDs to add", type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  lessonIds?: string[];
}

export class ReorderLessonsDto {
  @ApiProperty({ description: "Ordered array of lesson IDs", type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  lessonIds!: string[];
}
