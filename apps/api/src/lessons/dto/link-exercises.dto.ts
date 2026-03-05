import { IsArray, IsUUID, ArrayMinSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LinkExercisesDto {
  @ApiProperty({ description: "Array of exercise IDs to link", type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  exerciseIds!: string[];
}
