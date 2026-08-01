import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  CREDIT_BALANCE_REPOSITORY,
  type CreditBalanceRepository,
} from "../../../domain/ports/credit-balance.repository.port.js";
import { RefundCreditsCommand } from "./refund-credits.command.js";

/**
 * Devuelve créditos ya gastados. Nunca lanza por `ai_hard_limit`: el saldo
 * insuficiente bloquea GASTAR, no RECUPERAR una reserva.
 */
@CommandHandler(RefundCreditsCommand)
export class RefundCreditsHandler implements ICommandHandler<RefundCreditsCommand> {
  constructor(
    @Inject(CREDIT_BALANCE_REPOSITORY) private readonly credits: CreditBalanceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RefundCreditsCommand): Promise<{ balanceAfter: number }> {
    const { props } = command;
    const now = this.clock.now();

    return this.uow.execute(async () => {
      const balance = await this.credits.findForUpdate();

      balance.refund({
        credits: props.credits,
        note: props.note,
        aiGenerationId: props.aiGenerationId ?? null,
        now,
      });

      await this.credits.save(balance);

      return { balanceAfter: balance.balance };
    });
  }
}
