import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";

export class CaptureLeadDto {
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  locale?: string | null;

  @IsOptional()
  @IsString()
  message?: string | null;

  @IsOptional()
  @IsString()
  interestedLanguage?: string | null;

  @IsOptional()
  @IsIn(Object.values(CefrLevel))
  declaredLevel?: CefrLevel | null;

  @IsOptional()
  @IsString()
  sourcePage?: string | null;

  @IsOptional()
  @IsString()
  sourceCampaign?: string | null;

  @IsOptional()
  @IsString()
  referrer?: string | null;
}

class LeadGuardianDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(["mother", "father", "legal_guardian", "other"])
  relationship!: "mother" | "father" | "legal_guardian" | "other";
}

export class ConvertLeadDto {
  @IsString()
  @MinLength(10)
  dateOfBirth!: string;

  @IsString()
  @MinLength(2)
  nativeLanguage!: string;

  @IsString()
  @MinLength(2)
  targetLanguage!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadGuardianDto)
  guardian?: LeadGuardianDto | null;
}
