import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  CREDIT_BALANCE_REPOSITORY,
  type CreditBalanceRepository,
} from "../../../domain/ports/credit-balance.repository.port.js";
import { SpendCreditsCommand } from "./spend-credits.command.js";

/**
 * Gasta créditos de IA, con el tope duro de la escuela.
 *
 * Todo el trabajo ocurre dentro de UNA `uow.execute()`: cargar el saldo CON
 * BLOQUEO DE FILA (`findForUpdate()`), decidir si el gasto cabe
 * (`CreditBalance.spend()`, que lanza `InsufficientCreditsError` si
 * `ai_hard_limit` lo impide) y guardar. Si lanza, la transacción se deshace
 * entera y no queda ni una fila del libro mayor — la generación que llamó a
 * este comando ANTES de pedirle nada a un modelo simplemente no continúa.
 */
@CommandHandler(SpendCreditsCommand)
export class SpendCreditsHandler implements ICommandHandler<SpendCreditsCommand> {
  constructor(
    @Inject(CREDIT_BALANCE_REPOSITORY) private readonly credits: CreditBalanceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(SpendCreditsHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: SpendCreditsCommand): Promise<{ balanceAfter: number; overdrawn: boolean }> {
    const { props } = command;
    const now = this.clock.now();

    return this.uow.execute(async () => {
      const balance = await this.credits.findForUpdate();

      balance.spend({
        credits: props.credits,
        costCents: props.costCents ?? 0,
        note: props.note,
        aiGenerationId: props.aiGenerationId ?? null,
        now,
      });

      const overdrawn = !balance.hardLimit && balance.balance < 0;
      if (overdrawn) {
        this.logger.warn(
          `Escuela ${balance.schoolId.value}: gasto de ${props.credits} créditos sin tope duro. ` +
            `El saldo queda en ${balance.balance} — se permite y se avisa.`,
        );
      }

      await this.credits.save(balance);

      return { balanceAfter: balance.balance, overdrawn };
    });
  }
}
