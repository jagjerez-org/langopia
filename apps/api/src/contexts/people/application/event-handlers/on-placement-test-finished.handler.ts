import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { PlacementTestFinished } from "../../../assessment/domain/events/placement-test.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { LeadId } from "../../domain/model/identifiers.js";
import { LEAD_REPOSITORY, type LeadRepository } from "../../domain/ports/lead.repository.port.js";

/**
 * Vuelca el resultado de la nivelación en el candidato.
 *
 * Es el cierre del círculo que abrió `OnLeadCapturedStartPlacement` (en
 * `assessment`): `people` publicó `LeadCaptured`, `assessment` arrancó la
 * prueba, y ahora `assessment` publica `PlacementTestFinished` y `people` lo
 * escucha para dejar el nivel sugerido en el embudo. Los contextos solo se
 * conocen por los eventos: de `assessment` se importa únicamente la clase
 * del evento, que es su contrato público.
 *
 * El evento no lleva puntuación numérica (nivel MCER y desglose por
 * destreza), así que `placementScore` queda a null hasta que la escuela
 * confirme o corrija la sugerencia.
 */
@EventsHandler(PlacementTestFinished)
export class OnPlacementTestFinishedAssignLevel implements IEventHandler<PlacementTestFinished> {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async handle(event: PlacementTestFinished): Promise<void> {
    const payload = event.payload();

    // La prueba puede ser de un alumno ya matriculado, no de un candidato:
    // entonces aquí no hay nada que hacer.
    const lead = await this.uow.read(() => this.leads.find(LeadId.of(payload.studentProfileId)));
    if (!lead || !lead.acceptsPlacementResult()) return;

    await this.uow.execute(async () => {
      lead.assignPlacement({ level: payload.level });
      await this.leads.save(lead);
    });
  }
}
