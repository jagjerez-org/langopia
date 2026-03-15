import { IsString, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ParticipantRole } from "@langopia/shared/types";

export class TranscribeChunkDto {
  @ApiProperty({ description: "ID of the participant sending the audio" })
  @IsString()
  participantId!: string;

  @ApiProperty({
    description: "Role of the participant",
    enum: ParticipantRole,
  })
  @IsEnum(ParticipantRole)
  participantRole!: ParticipantRole;
}
