import { Injectable } from "@nestjs/common";
import { CancellationPolicy } from "../../domain/model/cancellation-policy.js";
import type { SchoolSchedulingPolicyPort } from "../../domain/ports/school-scheduling-policy.port.js";
import { DrizzleSchoolTimezoneRepository } from "../persistence/drizzle-school-timezone.repository.js";

const DEFAULT_TIMEZONE = "Europe/Madrid";

/**
 * Configuración de la escuela que afecta al calendario.
 *
 * La antelación mínima de cancelación todavía no es una columna: hoy se
 * devuelve la política por defecto de 24 horas. Cuando se haga configurable,
 * cambia solo este fichero —el dominio ya trabaja con el objeto de valor.
 *
 * El acceso a datos vive en `DrizzleSchoolTimezoneRepository`
 * (`infrastructure/persistence/`): este adaptador delega, no escribe SQL.
 */
@Injectable()
export class SchoolSchedulingPolicyAdapter implements SchoolSchedulingPolicyPort {
  constructor(private readonly repository: DrizzleSchoolTimezoneRepository) {}

  async cancellationPolicy(): Promise<CancellationPolicy> {
    return CancellationPolicy.default();
  }

  async timezone(): Promise<string> {
    return (await this.repository.timezone()) ?? DEFAULT_TIMEZONE;
  }
}
