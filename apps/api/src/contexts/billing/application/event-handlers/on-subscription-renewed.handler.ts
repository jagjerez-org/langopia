import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { SubscriptionRenewed } from "../../domain/events/subscription.events.js";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { CreditReason } from "../../domain/model/credit-balance.aggregate.js";
import {
  CREDIT_BALANCE_REPOSITORY,
  type CreditBalanceRepository,
} from "../../domain/ports/credit-balance.repository.port.js";

/**
 * La renovación de la suscripción concede los créditos incluidos del plan.
 *
 * «Sin acumular indefinidamente: el tope es dos veces los del plan» (brief) —
 * `CreditBalance.grant()` recibe ese tope y concede solo el hueco que quede
 * hasta él, nunca los créditos completos si la escuela ya arrastra sobras de
 * meses anteriores. No es un error que no quede hueco: simplemente no se
 * concede nada esa renovación.
 *
 * `SubscriptionRenewed` no lo emite hoy ningún productor real (ver el
 * comentario del propio evento): este manejador queda registrado, listo para
 * cuando exista.
 */
@EventsHandler(SubscriptionRenewed)
export class OnSubscriptionRenewed implements IEventHandler<SubscriptionRenewed> {
  constructor(
    @Inject(CREDIT_BALANCE_REPOSITORY) private readonly credits: CreditBalanceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(OnSubscriptionRenewed.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: SubscriptionRenewed): Promise<void> {
    const data = event.payload();
    const now = this.clock.now();
    const cap = data.includedAiCredits * 2;

    const balanceAfter = await this.uow.execute(async () => {
      const balance = await this.credits.findForUpdate();

      balance.grant({
        credits: data.includedAiCredits,
        reason: CreditReason.PlanGrant,
        note: `Renovación de suscripción — plan ${data.planCode}`,
        cap,
        now,
      });

      await this.credits.save(balance);
      return balance.balance;
    });

    this.logger.info(
      `Escuela ${event.schoolId}: renovación del plan ${data.planCode}. Saldo tras conceder hasta ` +
        `${data.includedAiCredits} créditos (tope de acumulación ${cap}): ${balanceAfter}.`,
    );
  }
}
