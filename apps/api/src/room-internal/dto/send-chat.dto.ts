import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendChatDto {
  @ApiProperty({ description: "Name of the message sender" })
  @IsString()
  @IsNotEmpty()
  senderName!: string;

  @ApiProperty({ description: "Role of sender: 'teacher' or 'student'" })
  @IsString()
  @IsNotEmpty()
  senderRole!: string;

  @ApiProperty({ description: "Chat message content" })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
