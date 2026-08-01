import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  PlacementBankExhaustedError,
  PlacementTestIdMismatchError,
} from "../../../domain/errors/assessment.errors.js";
import { scoreAutomatically } from "../../../domain/model/automatic-grading.js";
import { PlacementTest } from "../../../domain/model/placement-test.aggregate.js";
import {
  PLACEMENT_BANK_PORT,
  type PlacementBankPort,
} from "../../../domain/ports/placement-bank.port.js";
import { AnswerPlacementTestCommand, type AnswerPlacementTestResult } from "./answer-placement-test.command.js";

/**
 * Manejador del comando.
 *
 * Reconstruye `PlacementTest` del snapshot recibido (`rehydrate`, no hay
 * fila que cargar), busca el ítem realmente servido para saber su destreza,
 * nivel y `solution`, lo corrige con `scoreAutomatically` —el mismo
 * comparador genérico que usa `submit-attempt` para el resto de tipos sin
 * rúbrica, porque un ítem de nivelación tiene la misma forma
 * (`{correct: n}`)— y le pide a `PlacementTest.answer()` que decida si sube,
 * baja, se estabiliza o sigue.
 *
 * Sin escritura en base de datos, por la misma razón que `start`: el estado
 * que importa es el snapshot de la respuesta, no una fila.
 */
@CommandHandler(AnswerPlacementTestCommand)
export class AnswerPlacementTestHandler implements ICommandHandler<AnswerPlacementTestCommand> {
  constructor(
    @Inject(PLACEMENT_BANK_PORT) private readonly bank: PlacementBankPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AnswerPlacementTestCommand): Promise<AnswerPlacementTestResult> {
    const { props } = command;
    const now = this.clock.now();

    if (props.snapshot.id !== props.testId) {
      throw new PlacementTestIdMismatchError(props.testId, props.snapshot.id);
    }

    const { test, nextItem } = await this.uow.read(async () => {
      const item = await this.bank.get(props.itemId);
      if (!item) throw new NotFoundError("el ítem de nivelación", props.itemId);

      const graded = scoreAutomatically(props.response, item.solution, 1);
      const correct = graded.totalCount > 0 && graded.correctCount === graded.totalCount;

      const test = PlacementTest.rehydrate(props.snapshot);
      test.answer({ itemId: item.id, skill: item.skill, level: item.level, correct, now });

      const criteria = test.nextItemCriteria();
      if (!criteria) return { test, nextItem: null };

      const nextItem = await this.bank.pickNext({
        language: test.language,
        level: criteria.level,
        skill: criteria.skill,
        excludeItemIds: criteria.excludeItemIds,
      });
      if (!nextItem) throw new PlacementBankExhaustedError(test.language);

      return { test, nextItem };
    });

    await this.events.publish(test.pullDomainEvents());

    return {
      testId: test.id.value,
      finished: test.finished,
      nextQuestion: nextItem
        ? { itemId: nextItem.id, skill: nextItem.skill, level: nextItem.level, prompt: nextItem.prompt }
        : null,
      result: test.result,
      snapshot: test.toSnapshot(),
    };
  }
}
