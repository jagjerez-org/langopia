import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { InvoiceDirection } from "../../../domain/model/invoice-direction.js";
import { InvoiceId, StudentId } from "../../../domain/model/identifiers.js";
import { Invoice } from "../../../domain/model/invoice.aggregate.js";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../../domain/ports/invoice.repository.port.js";
import {
  SCHOOL_BILLING_POLICY_PORT,
  type SchoolBillingPolicyPort,
} from "../../../domain/ports/school-billing-policy.port.js";
import { IssueInvoiceCommand } from "./issue-invoice.command.js";

const DEFAULT_TAX_RATE_BPS = 2100;

/**
 * Emite una factura.
 *
 * La comisión de plataforma se pregunta AQUÍ, dentro de la transacción —vía
 * `SchoolBillingPolicyPort`, que lee la configuración de comisión de
 * `schools`— porque `Invoice.issue()` la necesita para congelarla y un
 * agregado no hace consultas. Es el único momento de toda la vida de la
 * factura en que se lee esa configuración: después de este `execute()`, nada
 * vuelve a mirarla.
 */
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements ICommandHandler<IssueInvoiceCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(SCHOOL_BILLING_POLICY_PORT) private readonly schoolBilling: SchoolBillingPolicyPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueInvoiceCommand) {
    const { props } = command;
    const direction = props.direction as InvoiceDirection;
    const schoolId = SchoolId.of(this.tenant.schoolId());
    const now = this.clock.now();
    const year = now.getFullYear();

    const invoice = await this.uow.execute(async () => {
      const currency = await this.schoolBilling.currency();
      const locale = await this.schoolBilling.defaultLocale();
      const fee =
        direction === InvoiceDirection.SchoolToStudent
          ? await this.schoolBilling.applicationFee()
          : { enabled: false, bps: 0, capCents: null };

      const sequence = await this.invoices.nextInvoiceNumber(year);
      const number =
        direction === InvoiceDirection.PlatformToSchool
          ? `LGP-${year}-${String(sequence).padStart(4, "0")}`
          : `${year}-${String(sequence).padStart(4, "0")}`;

      const created = Invoice.issue({
        id: InvoiceId.of(this.ids.generate()),
        schoolId,
        direction,
        studentId: props.studentId ? StudentId.of(props.studentId) : null,
        billToMembershipId: props.billToMembershipId
          ? MembershipId.of(props.billToMembershipId)
          : null,
        currency,
        locale,
        lines: props.lines.map((line) => ({ id: this.ids.generate(), ...line })),
        taxRateBps: props.taxRateBps ?? DEFAULT_TAX_RATE_BPS,
        feeBps: fee.bps,
        feeCapCents: fee.capCents,
        feeEnabled: fee.enabled,
        number,
        issuedOn: now,
        dueOn: new Date(props.dueOn),
      });

      await this.invoices.save(created);
      return created;
    });

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería haberse enterado de una factura que no existe.
    await this.events.publish(invoice.pullDomainEvents());

    return {
      invoiceId: invoice.id.value,
      number: invoice.number,
      totalCents: invoice.totalCents,
      currency: invoice.currency,
      applicationFeeBps: invoice.applicationFeeBps,
      applicationFeeCents: invoice.applicationFeeCents,
    };
  }
}
