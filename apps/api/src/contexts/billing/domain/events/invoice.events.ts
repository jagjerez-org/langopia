import { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { InvoiceDirection } from "../model/invoice-direction.js";

/**
 * Eventos del agregado `Invoice`. Contrato con el resto del sistema: quien
 * los consume no importa nada del dominio de facturación, solo primitivos.
 */

export class InvoiceIssued extends DomainEvent {
  readonly eventName = "billing.invoice.issued";

  constructor(
    private readonly data: {
      invoiceId: string;
      schoolId: string;
      direction: InvoiceDirection;
      number: string;
      totalCents: number;
      currency: string;
      applicationFeeBps: number;
      applicationFeeCents: number;
    },
  ) {
    super({ aggregateId: data.invoiceId, schoolId: data.schoolId });
  }

  payload() {
    return {
      invoiceId: this.data.invoiceId,
      direction: this.data.direction,
      number: this.data.number,
      totalCents: this.data.totalCents,
      currency: this.data.currency,
      applicationFeeBps: this.data.applicationFeeBps,
      applicationFeeCents: this.data.applicationFeeCents,
    };
  }
}

/**
 * Un cobro (total o parcial) quedó registrado en la factura.
 *
 * `resultingStatus` es `paid` solo cuando este cobro completa el total; un
 * cobro parcial deja la factura en `open` y a quien escuche (por ejemplo,
 * quien emite el recibo) le basta este evento para saber cuánto se acaba de
 * cobrar, sin volver a sumar nada.
 */
export class InvoicePaymentRecorded extends DomainEvent {
  readonly eventName = "billing.invoice.payment_recorded";

  constructor(
    private readonly data: {
      invoiceId: string;
      schoolId: string;
      amountCents: number;
      currency: string;
      method: string;
      providerRef: string;
      resultingStatus: string;
    },
  ) {
    super({ aggregateId: data.invoiceId, schoolId: data.schoolId });
  }

  payload() {
    return {
      invoiceId: this.data.invoiceId,
      amountCents: this.data.amountCents,
      currency: this.data.currency,
      method: this.data.method,
      providerRef: this.data.providerRef,
      resultingStatus: this.data.resultingStatus,
    };
  }
}

/**
 * Un intento de cobro falló (tarjeta rechazada, fondos insuficientes...).
 *
 * No es un cambio de estado de la factura —`markPaid()` es lo único que la
 * mueve, y aquí no se llama—: es un hecho que ocurrió y que interesa a quien
 * escucha (el aviso de cobro fallido), aunque `Invoice` en sí no cambie ni
 * un campo. Por eso lo emite `recordPaymentFailure()`, un método que
 * deliberadamente no toca ninguna propiedad del agregado.
 */
export class PaymentFailed extends DomainEvent {
  readonly eventName = "billing.payment.failed";

  constructor(
    private readonly data: {
      invoiceId: string;
      schoolId: string;
      amountCents: number;
      currency: string;
      failureCode: string | null;
      failureMessage: string | null;
    },
  ) {
    super({ aggregateId: data.invoiceId, schoolId: data.schoolId });
  }

  payload() {
    return {
      invoiceId: this.data.invoiceId,
      amountCents: this.data.amountCents,
      currency: this.data.currency,
      failureCode: this.data.failureCode,
      failureMessage: this.data.failureMessage,
    };
  }
}

/**
 * Se devolvió parte (o todo) de lo cobrado. `feeReversedCents` es la parte
 * proporcional de comisión que se revierte con esta devolución concreta, ya
 * calculada — quien escucha no vuelve a hacer la regla de tres.
 */
export class InvoiceRefunded extends DomainEvent {
  readonly eventName = "billing.invoice.refunded";

  constructor(
    private readonly data: {
      invoiceId: string;
      schoolId: string;
      amountCents: number;
      feeReversedCents: number;
      currency: string;
      reason: string;
    },
  ) {
    super({ aggregateId: data.invoiceId, schoolId: data.schoolId });
  }

  payload() {
    return {
      invoiceId: this.data.invoiceId,
      amountCents: this.data.amountCents,
      feeReversedCents: this.data.feeReversedCents,
      currency: this.data.currency,
      reason: this.data.reason,
    };
  }
}
