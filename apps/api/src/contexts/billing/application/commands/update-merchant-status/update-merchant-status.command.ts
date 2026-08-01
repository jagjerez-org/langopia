import { Command } from "@nestjs/cqrs";
import type { MerchantStatus } from "../../../domain/ports/school-billing-policy.port.js";

/**
 * Traduce `account.updated` (o el evento equivalente de cualquier otro
 * proveedor) a nuestro propio vocabulario. Quien despacha este comando ya
 * resolvió a qué escuela pertenece la cuenta y ya fijó su tenant — este
 * comando no recibe ninguna referencia de proveedor, solo el estado ya
 * traducido.
 */
export class UpdateMerchantStatusCommand extends Command<{ status: MerchantStatus }> {
  constructor(readonly props: { status: MerchantStatus }) {
    super();
  }
}
