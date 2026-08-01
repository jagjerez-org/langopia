import { Controller, HttpCode, Inject, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommandBus } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import type { Request } from "express";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { Public } from "../../../../shared/infrastructure/http/roles.decorator.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
} from "../../../../shared/infrastructure/tenant/cls-tenant-context.js";
import { ReconcilePaymentCommand } from "../../../application/commands/reconcile-payment/reconcile-payment.command.js";
import { ReconcileRefundCommand } from "../../../application/commands/reconcile-refund/reconcile-refund.command.js";
import { UpdateMerchantStatusCommand } from "../../../application/commands/update-merchant-status/update-merchant-status.command.js";
import {
  WEBHOOK_TENANT_RESOLVER,
  type WebhookTenantResolverPort,
} from "../../../domain/ports/webhook-tenant-resolver.port.js";
import { verifyStripeSignature } from "../../external/stripe/stripe-webhook-signature.js";
import {
  latestRefundOf,
  toMerchantStatus,
  toReconciledAmount,
  type StripeAccountEvent,
  type StripeChargeEvent,
  type StripePaymentIntent,
  type StripeWebhookEvent,
} from "../../external/stripe/stripe-types.js";

/**
 * Sin `STRIPE_WEBHOOK_SECRET` configurado no hay firma que verificar: fallar
 * aquí es un error nuestro (falta configuración), no un rechazo de la
 * petición — de ahí `kind: "invariant_violation"` (500 al cliente, no un
 * 4xx que insinuara que Stripe hizo algo mal).
 */
export class StripeWebhookNotConfiguredError extends DomainError {
  readonly code = "stripe_webhook_not_configured";
  readonly kind = "invariant_violation" as const;
  constructor() {
    super("No hay secreto de webhook configurado para el proveedor de pago.");
  }
}

/**
 * Sin verificar la firma, cualquiera que sepa la URL puede marcar una
 * factura como pagada — la regla que más se repite en el brief de esta
 * tarea.
 */
export class InvalidWebhookSignatureError extends DomainError {
  readonly code = "invalid_webhook_signature";
  readonly kind = "forbidden" as const;
  constructor() {
    super("La firma del webhook no es válida.");
  }
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Adaptador de ENTRADA para los avisos asíncronos de Stripe (paso 2 del
 * brief).
 *
 * Uno por proveedor, en su propia carpeta (`infrastructure/http/webhooks/`):
 * verifica SU firma y traduce SU evento a los mismos comandos que usaría
 * cualquier otro proveedor — `UpdateMerchantStatusCommand`,
 * `ReconcilePaymentCommand`, `ReconcileRefundCommand` no mencionan a Stripe
 * en ningún sitio. El dominio no sabe cuál le habló.
 *
 * `@Public()`: Stripe no manda sesión ni membresía, así que este endpoint no
 * pasa por `AuthenticatedGuard` ni por la resolución de tenant de
 * `SessionTenantGuard`. El tenant lo fija ESTE controlador, a mano, tras
 * resolver a qué escuela pertenece el evento (`WebhookTenantResolverPort`) —
 * mismo mecanismo que usa `SessionTenantGuard`, solo que la fuente de verdad
 * no es una sesión, es la referencia que trae el evento.
 */
@Public()
@Controller("billing/webhooks")
export class StripeWebhookController {
  constructor(
    private readonly commands: CommandBus,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    @Inject(WEBHOOK_TENANT_RESOLVER) private readonly tenantResolver: WebhookTenantResolverPort,
    @InjectPinoLogger(StripeWebhookController.name) private readonly logger: PinoLogger,
  ) {}

  @Post("stripe")
  @HttpCode(200)
  async handle(@Req() request: RawBodyRequest<Request>): Promise<{ received: true }> {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new StripeWebhookNotConfiguredError();

    const raw = request.rawBody;
    const payload = raw ? raw.toString("utf8") : "";
    const signatureHeader = headerValue(request, "stripe-signature");

    if (!raw || !verifyStripeSignature({ payload, signatureHeader, secret })) {
      throw new InvalidWebhookSignatureError();
    }

    const event = JSON.parse(payload) as StripeWebhookEvent;

    switch (event.type) {
      case "account.updated":
        await this.handleAccountUpdated(event.data.object as StripeAccountEvent);
        break;
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event.data.object as StripePaymentIntent, event);
        break;
      case "charge.refunded":
        await this.handleChargeRefunded(event.data.object as StripeChargeEvent, event);
        break;
      default:
        // Stripe puede añadir tipos de evento sin avisar, y este endpoint
        // solo se suscribe a los tres de arriba. Acusar recibo de todos modos
        // es correcto: no hacerlo serían reintentos eternos por algo que
        // nunca vamos a procesar.
        this.logger.debug(`Evento de Stripe sin manejar: ${event.type}`);
    }

    return { received: true };
  }

  private async handleAccountUpdated(account: StripeAccountEvent): Promise<void> {
    const schoolId = await this.tenantResolver.schoolIdForMerchantRef(account.id);
    if (!schoolId) {
      this.logger.warn(`account.updated de una cuenta que ninguna escuela tiene registrada: ${account.id}`);
      return;
    }
    this.fixTenant(schoolId);
    await this.commands.execute(
      new UpdateMerchantStatusCommand({ status: toMerchantStatus(account) }),
    );
  }

  private async handlePaymentIntentSucceeded(
    intent: StripePaymentIntent,
    event: StripeWebhookEvent,
  ): Promise<void> {
    const schoolId = await this.tenantResolver.schoolIdForChargeRef(intent.id);
    if (!schoolId) {
      this.logger.warn(`payment_intent.succeeded de un cobro que no reconocemos: ${intent.id}`);
      return;
    }
    this.fixTenant(schoolId);
    // El importe viaja con el comando: quien movió el dinero es el proveedor,
    // así que su cifra manda sobre la que tuviéramos registrada.
    const amount = toReconciledAmount(intent);
    await this.commands.execute(
      new ReconcilePaymentCommand({
        chargeRef: intent.id,
        amountCents: amount?.amountCents ?? null,
        currency: amount?.currency ?? null,
        // `event.id`, no `intent.id`: lo que se reenvía es el EVENTO. Dos
        // entregas del mismo aviso comparten `event.id`, y es esa igualdad la
        // que impide procesarlo dos veces.
        eventId: event.id,
        eventType: event.type,
      }),
    );
  }

  private async handleChargeRefunded(
    charge: StripeChargeEvent,
    event: StripeWebhookEvent,
  ): Promise<void> {
    const refund = latestRefundOf(charge);
    if (!charge.payment_intent || !refund) {
      this.logger.warn(`charge.refunded sin cobro o sin devolución que reconciliar: ${charge.id}`);
      return;
    }
    const schoolId = await this.tenantResolver.schoolIdForChargeRef(charge.payment_intent);
    if (!schoolId) {
      this.logger.warn(`charge.refunded de un cobro que no reconocemos: ${charge.payment_intent}`);
      return;
    }
    this.fixTenant(schoolId);
    await this.commands.execute(
      new ReconcileRefundCommand({
        refundRef: refund.id,
        eventId: event.id,
        eventType: event.type,
      }),
    );
  }

  /**
   * Fija el tenant de ESTA petición, a mano — mismo mecanismo que
   * `SessionTenantGuard`, sin sesión ni membresía detrás: un webhook no lo
   * abre nadie con un rol dentro de la escuela.
   */
  private fixTenant(schoolId: string): void {
    this.cls.set(CLS_SCHOOL_ID, schoolId);
    this.cls.set(CLS_MEMBERSHIP_ID, undefined);
    this.cls.set(CLS_ROLES, []);
  }
}
