import { IsUUID, IsOptional, IsString, IsEmail } from "class-validator";

export class CreatePublicSubscriptionDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsUUID()
  academyPlanId!: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
