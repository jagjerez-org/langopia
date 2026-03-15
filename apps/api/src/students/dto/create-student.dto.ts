import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  cefrEstimate?: string;
}
