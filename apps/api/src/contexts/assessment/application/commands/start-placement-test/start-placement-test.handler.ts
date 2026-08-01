import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { PlacementBankExhaustedError } from "../../../domain/errors/assessment.errors.js";
import { PlacementTestId } from "../../../domain/model/identifiers.js";
import { PlacementTest } from "../../../domain/model/placement-test.aggregate.js";
import {
  PLACEMENT_BANK_PORT,
  type PlacementBankPort,
} from "../../../domain/ports/placement-bank.port.js";
import { StartPlacementTestCommand, type StartPlacementTestResult } from "./start-placement-test.command.js";

/**
 * Manejador del comando.
 *
 * Coreografía, no reglas: pregunta al banco qué destrezas hay para este
 * idioma (`PlacementBankPort.listSkills`, tarea 8 de la ola 2 — el banco ya
 * viene calibrado en el seed, esto NO genera ítems con IA), le pide a
 * `PlacementTest.start()` que abra la prueba con esa rotación, y le pide al
 * banco el primer ítem para el criterio que el propio agregado decide
 * (`nextItemCriteria()`).
 *
 * Sin escritura en base de datos: no hay tabla de «prueba en curso» en esta
 * ola (ver cabecera de `PlacementTest`), así que todo esto es lectura —de
 * ahí `uow.read()` y no `uow.execute()`— y el estado que de verdad importa
 * viaja en la respuesta (`snapshot`), no en una fila.
 */
@CommandHandler(StartPlacementTestCommand)
export class StartPlacementTestHandler implements ICommandHandler<StartPlacementTestCommand> {
  constructor(
    @Inject(PLACEMENT_BANK_PORT) private readonly bank: PlacementBankPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: StartPlacementTestCommand): Promise<StartPlacementTestResult> {
    const { props } = command;
    const now = this.clock.now();
    const schoolId = SchoolId.of(this.tenant.schoolId());

    const { test, item } = await this.uow.read(async () => {
      const skills = await this.bank.listSkills(props.language);

      const test = PlacementTest.start({
        id: PlacementTestId.of(this.ids.generate()),
        schoolId,
        studentProfileId: props.studentProfileId,
        language: props.language,
        skills,
        now,
      });

      // Recién abierta, `nextItemCriteria()` nunca es null.
      const criteria = test.nextItemCriteria()!;
      const item = await this.bank.pickNext({
        language: props.language,
        level: criteria.level,
        skill: criteria.skill,
        excludeItemIds: criteria.excludeItemIds,
      });
      if (!item) throw new PlacementBankExhaustedError(props.language);

      return { test, item };
    });

    await this.events.publish(test.pullDomainEvents());

    return {
      testId: test.id.value,
      finished: false,
      nextQuestion: { itemId: item.id, skill: item.skill, level: item.level, prompt: item.prompt },
      snapshot: test.toSnapshot(),
    };
  }
}
