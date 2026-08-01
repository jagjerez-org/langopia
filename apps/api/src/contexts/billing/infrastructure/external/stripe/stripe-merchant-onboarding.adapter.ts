import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  MerchantOnboardingLink,
  MerchantOnboardingPort,
} from "../../../domain/ports/merchant-onboarding.port.js";
import { stripeRequest } from "./stripe-http.js";
import type { StripeAccount, StripeAccountLink } from "./stripe-types.js";

/**
 * Adaptador sobre la API REST de Stripe Connect (paso 1 del brief).
 *
 * Dos llamadas, siempre en el mismo orden: si la escuela no tiene cuenta
 * todavía, se crea (`POST /v1/accounts`); a continuación, siempre, se pide
 * un enlace de onboarding alojado por Stripe (`POST /v1/account_links`) —
 * nunca un formulario propio: recoger los datos de identidad de un
 * comerciante es responsabilidad y riesgo regulatorio de Stripe, no
 * nuestro.
 *
 * Usa la API v1 de cuentas (`type: "express"`), la misma familia que
 * `StripePaymentGatewayAdapter` (`transfer_data`/`application_fee_amount`
 * de `POST /v1/payment_intents`): mantener las dos llamadas del mismo
 * adaptador de comerciante en el mismo estilo de API —un único
 * `Content-Type`, un único cliente REST compartido (`stripe-http.ts`)— pesó
 * más que adoptar la API v2 de cuentas (`/v2/core/accounts`, JSON) que
 * Stripe recomienda hoy para plataformas nuevas: sin `STRIPE_SECRET_KEY` en
 * este entorno, ninguna de las dos formas es verificable contra la Stripe
 * real, y el puerto (`MerchantOnboardingPort`) no expone esta decisión —
 * cambiarla más adelante es un cambio local a este fichero.
 */
@Injectable()
export class StripeMerchantOnboardingAdapter implements MerchantOnboardingPort {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async createOnboardingLink(params: {
    merchantRef: string | null;
    country: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<MerchantOnboardingLink> {
    const merchantRef = params.merchantRef ?? (await this.createAccount(params.country));

    const link = await stripeRequest<StripeAccountLink>({
      secretKey: this.secretKey(),
      method: "POST",
      path: "/account_links",
      body: {
        account: merchantRef,
        return_url: params.returnUrl,
        refresh_url: params.refreshUrl,
        type: "account_onboarding",
      },
    });

    return { merchantRef, onboardingUrl: link.url };
  }

  private async createAccount(country: string): Promise<string> {
    const account = await stripeRequest<StripeAccount>({
      secretKey: this.secretKey(),
      method: "POST",
      path: "/accounts",
      body: {
        type: "express",
        country,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
      },
    });
    return account.id;
  }

  private secretKey(): string | undefined {
    return this.config.get<string>("STRIPE_SECRET_KEY");
  }
}
