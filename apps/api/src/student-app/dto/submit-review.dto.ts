import { IsInt, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SubmitReviewDto {
  @ApiProperty({ example: 4, description: "Quality rating 0-5 (SM-2)" })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}
