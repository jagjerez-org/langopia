import { IsOptional, IsUUID } from "class-validator";

/**
 * Filtro opcional de los tres endpoints `/portal/me/*`.
 *
 * Sin `studentId`, cada uno resuelve al alumno propio de la sesión. Con uno,
 * sirve para que un tutor con varios hijos elija cuál — y, si no es suyo,
 * para que `resolvePortalStudentId` lo rechace con 403 en vez de filtrar en
 * silencio.
 */
export class PortalStudentQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
