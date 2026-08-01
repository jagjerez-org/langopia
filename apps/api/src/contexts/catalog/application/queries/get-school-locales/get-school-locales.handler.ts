import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_LOCALE_PORT,
  type SchoolLocalePort,
} from "../../../domain/ports/school-locale.port.js";

export type SchoolLocales = { defaultLocale: string; supportedLocales: string[] };

export class GetSchoolLocalesQuery extends Query<SchoolLocales> {}

/**
 * Idiomas de la escuela activa (Tarea 8 del panel web): el alta de curso
 * necesita saber por cuáles pintar un campo de traducción.
 *
 * `uow.read(...)` no es opcional aquí, igual que en `GetSchoolTimezoneHandler`
 * (`scheduling`, Tarea 9): `DrizzleSchoolLocaleRepository` hace
 * `SELECT ... FROM schools LIMIT 1` SIN filtrar por escuela, apoyándose en
 * que RLS deje visible una sola fila — y eso solo es cierto DENTRO de una
 * transacción con `app.school_id` fijado. El único llamador que existía antes
 * de esta tarea (`CreateCourseHandler`) ya abría su propia transacción con
 * `uow.execute(...)`, así que nunca hizo falta aquí; esta consulta es la
 * primera en llamar al puerto SIN una transacción ya abierta alrededor, y sin
 * este `uow.read` la fila que devolvería sería la primera que Postgres tenga,
 * no la de la escuela de quien pregunta.
 */
@QueryHandler(GetSchoolLocalesQuery)
export class GetSchoolLocalesHandler implements IQueryHandler<GetSchoolLocalesQuery> {
  constructor(
    @Inject(SCHOOL_LOCALE_PORT) private readonly schoolLocale: SchoolLocalePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<SchoolLocales> {
    return this.uow.read(async () => ({
      defaultLocale: await this.schoolLocale.defaultLocale(),
      supportedLocales: await this.schoolLocale.supportedLocales(),
    }));
  }
}
