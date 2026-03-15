import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UnregisterPushTokenDto {
  @ApiProperty({ example: "fcm-token-string" })
  @IsString()
  token!: string;
}
