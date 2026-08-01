import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class StartImpersonationDto {
  @IsUUID()
  targetMembershipId!: string;

  /**
   * El mínimo real (10) lo comprueba el agregado (`Impersonation.start`,
   * que además recorta espacios antes de contar); aquí solo se adelanta un
   * 400 rápido con el campo señalado, igual que hace `RegisterSchoolDto`
   * con el slug.
   */
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
