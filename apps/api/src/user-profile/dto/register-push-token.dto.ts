import { IsString, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterPushTokenDto {
  @ApiProperty({ example: "fcm-token-string" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "android", enum: ["ios", "android", "web"] })
  @IsString()
  @IsIn(["ios", "android", "web"])
  platform!: string;
}
