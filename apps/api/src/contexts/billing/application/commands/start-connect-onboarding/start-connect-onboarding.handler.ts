import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  MERCHANT_ONBOARDING_PORT,
  type MerchantOnboardingPort,
} from "../../../domain/ports/merchant-onboarding.port.js";
import {
  SCHOOL_BILLING_POLICY_PORT,
  type SchoolBillingPolicyPort,
} from "../../../domain/ports/school-billing-policy.port.js";
import { StartConnectOnboardingCommand } from "./start-connect-onboarding.command.js";

/**
 * Paso 1 del brief: alta de comerciante, a través de `MerchantOnboardingPort`
 * — nunca llamando al proveedor de pago directamente desde aquí.
 *
 * La llamada al proveedor ocurre FUERA de `uow.execute()`, igual que
 * `RecordPaymentHandler` cobra fuera de la transacción: es una llamada de
 * red, no debe mantenerla abierta. Lo que sí se persiste dentro de una
 * transacción es el resultado — la referencia de comerciante, nueva o
 * reutilizada.
 */
@CommandHandler(StartConnectOnboardingCommand)
export class StartConnectOnboardingHandler
  implements ICommandHandler<StartConnectOnboardingCommand>
{
  constructor(
    @Inject(SCHOOL_BILLING_POLICY_PORT) private readonly schoolBilling: SchoolBillingPolicyPort,
    @Inject(MERCHANT_ONBOARDING_PORT) private readonly onboarding: MerchantOnboardingPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(command: StartConnectOnboardingCommand): Promise<{ onboardingUrl: string }> {
    const { merchantRef, country } = await this.uow.read(async () => ({
      merchantRef: await this.schoolBilling.merchantRef(),
      country: await this.schoolBilling.country(),
    }));

    const link = await this.onboarding.createOnboardingLink({
      merchantRef,
      country,
      returnUrl: command.props.returnUrl,
      refreshUrl: command.props.refreshUrl,
    });

    await this.uow.execute(() => this.schoolBilling.saveMerchantOnboarding(link.merchantRef));

    return { onboardingUrl: link.onboardingUrl };
  }
}
