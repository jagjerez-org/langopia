/**
 * El huevo y la gallina de un webhook: el proveedor de pago avisa de algo sin
 * traer sesión ni tenant, y antes de fijar `app.school_id` hace falta saber
 * de qué escuela habla. Mismo problema que resuelve `MembershipLookupPort` en
 * `iam` para una sesión que empieza — aquí no hay credencial que preguntar,
 * solo una referencia que el proveedor menciona en su evento.
 *
 * Las dos preguntas que puede hacer un evento entrante, y solo esas:
 *
 *   · «¿de qué escuela es esta cuenta de comerciante?» — para `account.updated`.
 *   · «¿de qué escuela es este cobro?» — para `payment_intent.succeeded` y
 *     `charge.refunded`, que llegan con la referencia del COBRO, no de la
 *     devolución; la devolución se busca después, ya con el tenant fijado.
 */
export interface WebhookTenantResolverPort {
  /** `null` si ninguna escuela tiene esta cuenta de comerciante. */
  schoolIdForMerchantRef(merchantRef: string): Promise<string | null>;

  /** `null` si ningún cobro nuestro tiene esta referencia del proveedor. */
  schoolIdForChargeRef(chargeRef: string): Promise<string | null>;
}

export const WEBHOOK_TENANT_RESOLVER = Symbol("WebhookTenantResolverPort");
