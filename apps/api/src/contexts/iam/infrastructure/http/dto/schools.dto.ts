import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { SUPPORTED_LOCALES } from "../../../../shared/infrastructure/i18n/locale.resolver.js";
import { MEMBERSHIP_ROLES } from "../../../domain/model/invitation.aggregate.js";

/**
 * DTO de entrada: valida la FORMA. El alfabeto y la longitud del slug se
 * repiten aquí para un 400 rápido con el campo señalado; la palabra
 * reservada y la unicidad global las decide el dominio (`SchoolSlug`) y la
 * base de datos, respectivamente — no hay forma de comprobarlas con una
 * expresión regular.
 */
export class RegisterSchoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/, {
    message: "slug solo admite minúsculas, números y guiones",
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(MEMBERSHIP_ROLES)
  role!: string;
}

/**
 * PATCH de "marca" e "idiomas" del asistente de puesta en marcha (Tarea 12
 * del panel): los dos campos son opcionales, cada uno se valida solo si
 * llega. `supportedLocales` no es un campo de este DTO — lo decide el
 * manejador a partir de `defaultLocale` (ver `UpdateSchoolSettingsHandler`).
 */
export class UpdateSchoolSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  defaultLocale?: string;
}
