import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles, RestrictedWhileImpersonating } from "../../../shared/infrastructure/http/roles.decorator.js";
import { IssueInvoiceCommand } from "../../application/commands/issue-invoice/issue-invoice.command.js";
import { RecordPaymentCommand } from "../../application/commands/record-payment/record-payment.command.js";
import { RefundPaymentCommand } from "../../application/commands/refund-payment/refund-payment.command.js";
import { StartConnectOnboardingCommand } from "../../application/commands/start-connect-onboarding/start-connect-onboarding.command.js";
import { GetBillingSummaryQuery } from "../../application/queries/get-billing-summary/get-billing-summary.handler.js";
import { GetInvoiceDetailQuery } from "../../application/queries/get-invoice-detail/get-invoice-detail.handler.js";
import { GetMerchantStatusQuery } from "../../application/queries/get-merchant-status/get-merchant-status.handler.js";
import { ListInvoicesQuery } from "../../application/queries/list-invoices/list-invoices.handler.js";
import {
  IssueInvoiceDto,
  ListInvoicesQueryDto,
  RecordPaymentDto,
  RefundPaymentDto,
  StartConnectOnboardingDto,
} from "./dto/billing.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Sin lógica de negocio, igual que `SchedulingController` y
 * `CatalogController`: traduce la petición a un comando, lo pone en el bus y
 * devuelve el resultado. Ningún importe se calcula aquí — lo prohíbe el
 * brief de la tarea, y de todos modos no hay ningún `+`/`*` en este fichero.
 *
 * `owner`/`admin` en las tres rutas: es el rol más estricto que tiene
 * sentido sin romper el trabajo diario de quien de verdad cobra y devuelve
 * (`membership_role.admin` incluye explícitamente «cobros» en su
 * descripción de dominio, `packages/db/src/schema/enums.ts`).
 */
@Roles("owner", "admin")
@Controller("billing")
export class BillingController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /** Listado de facturas (Tarea 10 del panel, Paso 1), opcionalmente filtrado por estado. */
  @Get("invoices")
  async list(@Query() query: ListInvoicesQueryDto) {
    return this.queries.execute(new ListInvoicesQuery({ status: query.status }));
  }

  /**
   * Total facturado este mes (Tarea 10 del panel, Paso 1). Ruta estática
   * antes que `invoices/:id`, como ya hace `SchedulingController` con sus
   * rutas de agenda: si no, `:id` se comería `summary` como si fuera un UUID.
   */
  @Get("invoices/summary")
  async summary() {
    return this.queries.execute(new GetBillingSummaryQuery());
  }

  /** Detalle de una factura (Tarea 10 del panel, Paso 2): líneas, cobros, devoluciones y comisión. */
  @Get("invoices/:id")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.queries.execute(new GetInvoiceDetailQuery({ invoiceId: id }));
  }

  /** Estado del comerciante y comisión vigente (Tarea 10 del panel, Paso 4). */
  @Get("merchant/status")
  async merchantStatus() {
    return this.queries.execute(new GetMerchantStatusQuery());
  }

  @Post("invoices")
  async issue(@Body() dto: IssueInvoiceDto) {
    return this.commands.execute(
      new IssueInvoiceCommand({
        direction: dto.direction,
        studentId: dto.studentId ?? null,
        billToMembershipId: dto.billToMembershipId ?? null,
        lines: dto.lines,
        taxRateBps: dto.taxRateBps,
        dueOn: dto.dueOn,
      }),
    );
  }

  /** Tarea 17: cobrar dinero real de otra persona no es soporte. */
  @RestrictedWhileImpersonating("payment_operation")
  @Post("invoices/:id/payments")
  @HttpCode(200)
  async recordPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.commands.execute(
      new RecordPaymentCommand({
        invoiceId: id,
        payerEmail: dto.payerEmail,
        payerProviderCustomerRef: dto.payerProviderCustomerRef ?? null,
        amountCents: dto.amountCents ?? null,
        method: dto.method,
        idempotencyKey: dto.idempotencyKey,
      }),
    );
  }

  /** Tarea 17: devolver dinero real de otra persona no es soporte. */
  @RestrictedWhileImpersonating("payment_operation")
  @Post("invoices/:id/refunds")
  @HttpCode(200)
  async refund(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto) {
    return this.commands.execute(
      new RefundPaymentCommand({
        invoiceId: id,
        amountCents: dto.amountCents,
        reason: dto.reason,
        idempotencyKey: dto.idempotencyKey,
      }),
    );
  }

  /**
   * Paso 1 del brief: alta de comerciante. La escuela puede usar todo el
   * producto antes de llamar a esto — cobrar se activa cuando esté lista,
   * no el día uno.
   */
  /** Tarea 17: es cambiar cómo cobra la escuela, dato de pago igual que el resto. */
  @RestrictedWhileImpersonating("payment_operation")
  @Post("merchant/onboarding")
  @HttpCode(200)
  async startMerchantOnboarding(@Body() dto: StartConnectOnboardingDto) {
    return this.commands.execute(
      new StartConnectOnboardingCommand({
        returnUrl: dto.returnUrl,
        refreshUrl: dto.refreshUrl,
      }),
    );
  }
}
