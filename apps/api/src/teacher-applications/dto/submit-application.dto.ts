import { IsString, IsEmail, IsOptional, IsArray, MaxLength, IsObject } from "class-validator";

export class SubmitApplicationDto {
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cvUrl?: string;

  @IsOptional()
  @IsArray()
  attachments?: { name: string; url: string }[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
