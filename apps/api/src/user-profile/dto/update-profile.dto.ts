import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiProperty({ example: "John Doe" })
  @IsString()
  @MinLength(1)
  name!: string;
}
