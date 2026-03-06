import { IsString, IsOptional, IsInt, Min, MaxLength, IsDateString } from "class-validator";

export class CreateInviteLinkDto {
  @IsString()
  @MaxLength(50)
  targetRole!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
