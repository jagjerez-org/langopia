import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SwitchLanguageDto {
  @ApiProperty({ example: "fr" })
  @IsString()
  learningLanguage!: string;
}
