import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_REPOSITORY,
  type SchoolRepositoryPort,
} from "../../../domain/ports/school-repository.port.js";

export type SchoolSettingsResult = {
  name: string;
  defaultLocale: string;
  supportedLocales: string[];
  status: string;
  trialEndsAt: string | null;
};

export class GetSchoolSettingsQuery extends Query<SchoolSettingsResult> {}

/**
 * Ajustes de la escuela activa (Tarea 12 del panel): prellenar el asistente
 * de puesta en marcha ("marca", "idiomas") y el aviso de días de prueba.
 *
 * `uow.read(...)` no es opcional: `DrizzleSchoolRepository.findCurrent()`
 * hace `SELECT ... FROM schools LIMIT 1` sin filtrar por escuela, apoyado en
 * que RLS deja visible una sola fila DENTRO de una transacción con
 * `app.school_id` fijado — exactamente el mismo motivo, ya demostrado en
 * vivo, por el que `GetSchoolTimezoneHandler` (Tarea 9) envuelve su lectura
 * igual.
 */
@QueryHandler(GetSchoolSettingsQuery)
export class GetSchoolSettingsHandler implements IQueryHandler<GetSchoolSettingsQuery> {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly schools: SchoolRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<SchoolSettingsResult> {
    const settings = await this.uow.read(() => this.schools.findCurrent());
    if (!settings) {
      // No debería ocurrir: `SessionTenantGuard` ya resolvió esta escuela
      // antes de dejar pasar la petición hasta aquí.
      throw new Error("La escuela activa no existe.");
    }
    return {
      name: settings.name,
      defaultLocale: settings.defaultLocale,
      supportedLocales: settings.supportedLocales,
      status: settings.status,
      trialEndsAt: settings.trialEndsAt ? settings.trialEndsAt.toISOString() : null,
    };
  }
}
