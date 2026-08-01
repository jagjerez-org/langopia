import { Module } from "@nestjs/common";
import { IssueInvoiceHandler } from "./application/commands/issue-invoice/issue-invoice.handler.js";
import { ReconcilePaymentHandler } from "./application/commands/reconcile-payment/reconcile-payment.handler.js";
import { ReconcileRefundHandler } from "./application/commands/reconcile-refund/reconcile-refund.handler.js";
import { RecordPaymentHandler } from "./application/commands/record-payment/record-payment.handler.js";
import { RefundPaymentHandler } from "./application/commands/refund-payment/refund-payment.handler.js";
import { RefundCreditsHandler } from "./application/commands/spend-credits/refund-credits.handler.js";
import { SpendCreditsHandler } from "./application/commands/spend-credits/spend-credits.handler.js";
import { StartConnectOnboardingHandler } from "./application/commands/start-connect-onboarding/start-connect-onboarding.handler.js";
import { UpdateMerchantStatusHandler } from "./application/commands/update-merchant-status/update-merchant-status.handler.js";
import { OnClassSessionCanceled } from "./application/event-handlers/on-class-session-canceled.handler.js";
import { OnSubscriptionRenewed } from "./application/event-handlers/on-subscription-renewed.handler.js";
import { GetBillingSummaryHandler } from "./application/queries/get-billing-summary/get-billing-summary.handler.js";
import { GetInvoiceDetailHandler } from "./application/queries/get-invoice-detail/get-invoice-detail.handler.js";
import { GetMerchantStatusHandler } from "./application/queries/get-merchant-status/get-merchant-status.handler.js";
import { ListInvoicesHandler } from "./application/queries/list-invoices/list-invoices.handler.js";
import { BILLING_READ_MODEL } from "./application/ports/billing-read-model.port.js";
import { CREDIT_BALANCE_REPOSITORY } from "./domain/ports/credit-balance.repository.port.js";
import { INVOICE_REPOSITORY } from "./domain/ports/invoice.repository.port.js";
import { MERCHANT_ONBOARDING_PORT } from "./domain/ports/merchant-onboarding.port.js";
import { PAYMENT_GATEWAY } from "./domain/ports/payment-gateway.port.js";
import { PROCESSED_WEBHOOK_EVENTS } from "./domain/ports/processed-webhook-events.port.js";
import { SCHOOL_BILLING_POLICY_PORT } from "./domain/ports/school-billing-policy.port.js";
import { WEBHOOK_TENANT_RESOLVER } from "./domain/ports/webhook-tenant-resolver.port.js";
import { SchoolBillingPolicyAdapter } from "./infrastructure/acl/school-billing-policy.adapter.js";
import { StripeMerchantOnboardingAdapter } from "./infrastructure/external/stripe/stripe-merchant-onboarding.adapter.js";
import { StripePaymentGatewayAdapter } from "./infrastructure/external/stripe/stripe-payment-gateway.adapter.js";
import { BillingController } from "./infrastructure/http/billing.controller.js";
import { StripeWebhookController } from "./infrastructure/http/webhooks/stripe-webhook.controller.js";
import { DrizzleBillingReadModel } from "./infrastructure/persistence/drizzle-billing-read-model.js";
import { DrizzleCreditBalanceRepository } from "./infrastructure/persistence/drizzle-credit-balance.repository.js";
import { DrizzleInvoiceRepository } from "./infrastructure/persistence/drizzle-invoice.repository.js";
import { DrizzleProcessedWebhookEvents } from "./infrastructure/persistence/drizzle-processed-webhook-events.repository.js";
import { DrizzleSchoolBillingRepository } from "./infrastructure/persistence/drizzle-school-billing.repository.js";
import { DrizzleWebhookTenantResolverRepository } from "./infrastructure/persistence/drizzle-webhook-tenant-resolver.repository.js";

const commandHandlers = [
  IssueInvoiceHandler,
  RecordPaymentHandler,
  RefundPaymentHandler,
  StartConnectOnboardingHandler,
  UpdateMerchantStatusHandler,
  ReconcilePaymentHandler,
  ReconcileRefundHandler,
  SpendCreditsHandler,
  RefundCreditsHandler,
];

/** Tarea 10 del panel: los cuatro `GET` de facturación, todos de solo lectura. */
const queryHandlers = [
  ListInvoicesHandler,
  GetInvoiceDetailHandler,
  GetBillingSummaryHandler,
  GetMerchantStatusHandler,
];

/**
 * Contexto acotado de facturación.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada
 * puerto, y nada de esto sale fuera — mismo patrón que `SchedulingModule` y
 * `CatalogModule`. `StripePaymentGatewayAdapter`/`StripeMerchantOnboardingAdapter`
 * son hoy los únicos adaptadores de `PAYMENT_GATEWAY`/`MERCHANT_ONBOARDING_PORT`;
 * el día que haya un segundo proveedor, estas son las únicas líneas que cambian.
 */
@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    OnClassSessionCanceled,
    OnSubscriptionRenewed,
    DrizzleSchoolBillingRepository,
    { provide: INVOICE_REPOSITORY, useClass: DrizzleInvoiceRepository },
    { provide: CREDIT_BALANCE_REPOSITORY, useClass: DrizzleCreditBalanceRepository },
    { provide: BILLING_READ_MODEL, useClass: DrizzleBillingReadModel },
    { provide: SCHOOL_BILLING_POLICY_PORT, useClass: SchoolBillingPolicyAdapter },
    { provide: PAYMENT_GATEWAY, useClass: StripePaymentGatewayAdapter },
    { provide: MERCHANT_ONBOARDING_PORT, useClass: StripeMerchantOnboardingAdapter },
    { provide: WEBHOOK_TENANT_RESOLVER, useClass: DrizzleWebhookTenantResolverRepository },
    { provide: PROCESSED_WEBHOOK_EVENTS, useClass: DrizzleProcessedWebhookEvents },
  ],
})
export class BillingModule {}
