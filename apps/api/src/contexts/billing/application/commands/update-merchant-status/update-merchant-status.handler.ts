import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_BILLING_POLICY_PORT,
  type MerchantStatus,
  type SchoolBillingPolicyPort,
} from "../../../domain/ports/school-billing-policy.port.js";
import { UpdateMerchantStatusCommand } from "./update-merchant-status.command.js";

/**
 * Paso 3 del brief: `account.updated` (u otro evento equivalente) ya
 * traducido a `active`/`restricted`. Escribe una sola cosa —el estado del
 * comerciante de la escuela activa— dentro de la transacción de la petición
 * (el webhook ya fijó el tenant antes de despachar este comando).
 */
@CommandHandler(UpdateMerchantStatusCommand)
export class UpdateMerchantStatusHandler implements ICommandHandler<UpdateMerchantStatusCommand> {
  constructor(
    @Inject(SCHOOL_BILLING_POLICY_PORT) private readonly schoolBilling: SchoolBillingPolicyPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(command: UpdateMerchantStatusCommand): Promise<{ status: MerchantStatus }> {
    await this.uow.execute(() => this.schoolBilling.updateMerchantStatus(command.props.status));
    return { status: command.props.status };
  }
}
