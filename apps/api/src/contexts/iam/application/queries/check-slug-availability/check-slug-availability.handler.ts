import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { InvalidSchoolSlugError } from "../../../domain/model/school-slug.vo.js";
import { SchoolSlug } from "../../../domain/model/school-slug.vo.js";
import {
  SCHOOL_REPOSITORY,
  type SchoolRepositoryPort,
} from "../../../domain/ports/school-repository.port.js";

export class CheckSlugAvailabilityQuery extends Query<{ available: boolean }> {
  constructor(readonly slug: string) {
    super();
  }
}

/**
 * Aviso de disponibilidad EN VIVO (Tarea 12 del panel: registro y puesta en
 * marcha), mientras se escribe el formulario y antes de enviarlo.
 *
 * Corre SIN tenant, hermana de `RegisterSchoolHandler`: quien mira todavía
 * no tiene sesión resuelta en ninguna escuela. Un formato inválido
 * (`SchoolSlug.of` lanza `InvalidSchoolSlugError`: longitud, alfabeto o
 * palabra reservada) se traduce aquí a "no disponible" — no hay una escuela
 * real que reservar con ese identificador de todas formas, así que "no
 * disponible, prueba otro" es tan cierto como "el formato no vale", y evita
 * que el panel necesite dos avisos distintos para el mismo campo. El
 * formulario de registro sigue mostrando el motivo EXACTO si llega a
 * enviarse con un slug inválido: eso lo decide `RegisterSchoolHandler`
 * (`POST /schools/register`), esta consulta nunca lo repite.
 */
@QueryHandler(CheckSlugAvailabilityQuery)
export class CheckSlugAvailabilityHandler implements IQueryHandler<CheckSlugAvailabilityQuery> {
  constructor(@Inject(SCHOOL_REPOSITORY) private readonly schools: SchoolRepositoryPort) {}

  async execute(query: CheckSlugAvailabilityQuery): Promise<{ available: boolean }> {
    try {
      SchoolSlug.of(query.slug);
    } catch (error) {
      if (error instanceof InvalidSchoolSlugError) return { available: false };
      throw error;
    }
    const taken = await this.schools.existsBySlug(query.slug);
    return { available: !taken };
  }
}
