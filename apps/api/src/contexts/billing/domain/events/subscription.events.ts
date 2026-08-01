import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * El plan de una escuela se renovó por otro ciclo de facturación.
 *
 * No hay todavía un agregado `Subscription` en el código —`subscriptions` es
 * hoy una fila que crea `TrialSubscriptionPort` (`iam`) al empezar una
 * prueba, y ninguna tarea de esta ola gestiona su ciclo de vida completo—,
 * así que este evento es el CONTRATO mínimo que necesita
 * `OnSubscriptionRenewed` (Tarea 5) para conceder los créditos incluidos del
 * plan. Emitirlo de verdad (el webhook del proveedor de pago que confirma
 * cada ciclo, o el trabajo que revisa suscripciones vencidas) es de una
 * tarea futura que gestione `Subscription`; hasta entonces, este evento solo
 * lo construyen las pruebas.
 *
 * `includedAiCredits` viaja YA resuelto por quien emite el evento —el mismo
 * criterio que `ClassSessionCanceled.refundDue`—: este contexto no vuelve a
 * consultar `plans` para saber cuántos créditos trae el plan, confía en el
 * dato que ya trae el hecho.
 */
export class SubscriptionRenewed extends DomainEvent {
  readonly eventName = "billing.subscription.renewed";

  constructor(
    private readonly data: {
      subscriptionId: string;
      schoolId: string;
      planCode: string;
      includedAiCredits: number;
      periodStart: Date;
      periodEnd: Date;
    },
  ) {
    super({ aggregateId: data.subscriptionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      subscriptionId: this.data.subscriptionId,
      planCode: this.data.planCode,
      includedAiCredits: this.data.includedAiCredits,
      periodStart: this.data.periodStart.toISOString(),
      periodEnd: this.data.periodEnd.toISOString(),
    };
  }
}
