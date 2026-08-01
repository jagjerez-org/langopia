import { Injectable } from "@nestjs/common";
import type { MinorGuardianContext, MinorGuardianLookupPort } from "../../domain/ports/minor-guardian-lookup.port.js";
import { DrizzleMinorGuardianRepository } from "../persistence/drizzle-minor-guardian.repository.js";

/**
 * Capa anticorrupción hacia `people`.
 *
 * `iam` necesita saber una cosa de una membresía cualquiera: ¿es un alumno
 * menor, y quién es su tutor? En vez de importar el agregado `Student` de
 * `people` —lo que ataría la impersonación a cada cambio de esa ficha—, este
 * adaptador traduce el modelo ajeno a esa única pregunta. Mismo patrón que
 * `PeopleTeacherAvailabilityAdapter` en `scheduling`.
 */
@Injectable()
export class PeopleMinorGuardianAdapter implements MinorGuardianLookupPort {
  constructor(private readonly repository: DrizzleMinorGuardianRepository) {}

  contextFor(membershipId: string): Promise<MinorGuardianContext> {
    return this.repository.contextFor(membershipId);
  }
}
