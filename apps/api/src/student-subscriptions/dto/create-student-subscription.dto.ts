import { IsUUID, IsOptional, IsString } from "class-validator";

export class CreateStudentSubscriptionDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  academyPlanId!: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
