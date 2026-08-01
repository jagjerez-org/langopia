import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ChargeResult,
  PayerRef,
  PaymentGatewayPort,
  PaymentStatus,
  ProviderRef,
  RefundResult,
} from "../../../domain/ports/payment-gateway.port.js";
import type { Money } from "../../../domain/model/money.vo.js";
import type { PlatformFee } from "../../../domain/model/platform-fee.vo.js";
import { stripeRequest } from "./stripe-http.js";
import {
  toChargeResult,
  toPaymentStatus,
  toRefundResult,
  type StripePaymentIntent,
  type StripeRefund,
} from "./stripe-types.js";

/**
 * Adaptador sobre la API REST de Stripe (Connect, cargos de destino).
 *
 * Todo el vocabulario de Stripe —`PaymentIntent`, `application_fee_amount`,
 * `transfer_data`, sus estados propios— vive en esta carpeta, traducido por
 * `stripe-types.ts` a los tipos del puerto. Nada de esto se filtra hacia
 * `domain/` ni `application/` (`domain-purity.spec.ts` lo comprueba solo).
 *
 * `charge()` crea un cargo de DESTINO: el dinero entra en la cuenta Connect
 * de la escuela (`transfer_data[destination]`) y Stripe retiene
 * `application_fee_amount` para la plataforma en el mismo movimiento — ni la
 * escuela ve el dinero de la comisión ni la plataforma tiene que
 * transferírselo ella misma después.
 *
 * Sin `stripe` como dependencia del paquete: dos llamadas REST con `fetch`
 * (disponible en Node ≥ 18) no justifican añadir el SDK completo para un
 * adaptador que hoy no se ejecuta contra la red en ningún entorno de prueba
 * de este repositorio (sin `STRIPE_SECRET_KEY` en `.env`, ver el informe de
 * la tarea). El día que haga falta más superficie de su API, el SDK sí
 * compensa.
 */
@Injectable()
export class StripePaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async charge(params: {
    amount: Money;
    fee: PlatformFee;
    payer: PayerRef;
    merchant: ProviderRef;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    const body: Record<string, string> = {
      amount: String(params.amount.cents),
      currency: params.amount.currency.toLowerCase(),
      "transfer_data[destination]": params.merchant.ref,
      confirm: "true",
      off_session: "true",
      receipt_email: params.payer.email,
    };
    if (params.fee.cents > 0) {
      body.application_fee_amount = String(params.fee.cents);
    }
    if (params.payer.providerCustomerRef) {
      body.customer = params.payer.providerCustomerRef;
    }

    const intent = await this.request<StripePaymentIntent>(
      "POST",
      "/payment_intents",
      body,
      params.idempotencyKey,
    );
    return toChargeResult(intent);
  }

  async refund(params: {
    charge: ProviderRef;
    amount: Money;
    reason: string;
    feeReversed: Money;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const body: Record<string, string> = {
      payment_intent: params.charge.ref,
      amount: String(params.amount.cents),
      // Devuelve también la parte proporcional de la transferencia a la
      // cuenta conectada — sin esto, la escuela se queda con dinero que ya
      // no debería tener.
      reverse_transfer: "true",
    };
    if (params.feeReversed.cents > 0) {
      body.refund_application_fee = "true";
    }

    const refund = await this.request<StripeRefund>("POST", "/refunds", body, params.idempotencyKey);
    return toRefundResult(refund);
  }

  async statusOf(charge: ProviderRef): Promise<PaymentStatus> {
    const intent = await this.request<StripePaymentIntent>(
      "GET",
      `/payment_intents/${encodeURIComponent(charge.ref)}`,
    );
    return toPaymentStatus(intent);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<T> {
    return stripeRequest<T>({
      secretKey: this.config.get<string>("STRIPE_SECRET_KEY"),
      method,
      path,
      body,
      idempotencyKey,
    });
  }
}
