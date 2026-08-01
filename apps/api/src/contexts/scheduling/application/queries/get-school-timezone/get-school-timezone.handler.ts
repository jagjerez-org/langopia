import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { SchoolTimezone } from "@langopia/contracts";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_SCHEDULING_POLICY_PORT,
  type SchoolSchedulingPolicyPort,
} from "../../../domain/ports/school-scheduling-policy.port.js";

export class GetSchoolTimezoneQuery extends Query<SchoolTimezone> {}

/**
 * Zona horaria de la escuela activa (Tarea 9 del panel).
 *
 * El calendario tiene que mostrar cada clase en la hora de la escuela, nunca
 * la del navegador. `SchoolSchedulingPolicyPort.timezone()` ya existía
 * (declarado en el puerto, con `DrizzleSchoolTimezoneRepository` como
 * implementación), pero hasta esta tarea NADA lo llamaba en la práctica: es
 * dominio muerto que esta consulta es la primera en ejercitar de verdad.
 *
 * `uow.read(...)` no es opcional aquí, aunque el repositorio no declare
 * ninguna escritura: `DrizzleSchoolTimezoneRepository.timezone()` hace
 * `SELECT ... FROM schools LIMIT 1` SIN filtrar por escuela, apoyándose en
 * que RLS deje visible una sola fila — y eso solo es cierto DENTRO de una
 * transacción con `app.school_id` fijado (`DrizzleUnitOfWork`). Sin este
 * `uow.read`, la consulta corre en la conexión suelta (`DrizzleService.db`
 * cae a `this.root` cuando no hay transacción activa en CLS) y la política
 * de RLS de `schools` —más permisiva que la del resto de tablas, porque
 * resolver el tenant necesita poder leerla antes de que exista tenant—
 * devuelve la escuela que Postgres tenga primera, no la de quien pregunta.
 * Comprobado de verdad en vivo: sin este `uow.read`, entrar como una escuela
 * de Alemania seguía devolviendo la zona horaria de la primera escuela del
 * seed (Madrid).
 */
@QueryHandler(GetSchoolTimezoneQuery)
export class GetSchoolTimezoneHandler implements IQueryHandler<GetSchoolTimezoneQuery> {
  constructor(
    @Inject(SCHOOL_SCHEDULING_POLICY_PORT) private readonly policy: SchoolSchedulingPolicyPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<SchoolTimezone> {
    const timezone = await this.uow.read(() => this.policy.timezone());
    return { timezone };
  }
}
