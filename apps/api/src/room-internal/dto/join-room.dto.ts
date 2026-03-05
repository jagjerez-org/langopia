import { IsString, IsOptional, IsEmail } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class JoinRoomDto {
  @ApiProperty({ description: "Room or Class teacher/student token" })
  @IsString()
  token!: string;

  @ApiPropertyOptional({ description: "Participant display name (required for students)" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Student email (required for students)" })
  @IsOptional()
  @IsEmail()
  email?: string;
}
