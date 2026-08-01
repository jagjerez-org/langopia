import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantAccountStatus } from "@langopia/contracts";
import {
  BILLING_READ_MODEL,
  type BillingReadModel,
} from "../../ports/billing-read-model.port.js";

export class GetMerchantStatusQuery extends Query<MerchantAccountStatus> {}

/**
 * Estado del comerciante de la escuela activa (Tarea 10 del panel, Paso 4):
 * alimenta la pantalla de conexión con el proveedor de pago, que tiene que
 * dejar claro que el producto se puede usar sin conectar y qué se desbloquea
 * al hacerlo.
 *
 * No usa `SchoolBillingPolicyPort` (el puerto que sí consumen los comandos de
 * facturación): ese puerto no expone `merchant_status` como tal —solo
 * `merchantRef()`, para saber SI existe cuenta, no en qué estado está— y
 * ampliarlo para un dato de solo lectura movería una consulta a un puerto
 * pensado para comandos. El modelo de lectura ya cruza `schools` para otras
 * consultas de esta misma tarea; esta es una más.
 */
@QueryHandler(GetMerchantStatusQuery)
export class GetMerchantStatusHandler implements IQueryHandler<GetMerchantStatusQuery> {
  constructor(@Inject(BILLING_READ_MODEL) private readonly readModel: BillingReadModel) {}

  async execute(): Promise<MerchantAccountStatus> {
    return this.readModel.merchantStatus();
  }
}
