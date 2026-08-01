import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import { SessionId } from "../../../domain/model/identifiers.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../../domain/ports/class-session.repository.port.js";
import {
  SCHOOL_SCHEDULING_POLICY_PORT,
  type SchoolSchedulingPolicyPort,
} from "../../../domain/ports/school-scheduling-policy.port.js";
import { CancelClassSessionCommand } from "./cancel-class-session.command.js";

export class MissingActorError extends DomainError {
  readonly code = "missing_actor";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Cancelar una clase requiere saber quién la cancela.");
  }
}

/**
 * Cancelar una clase.
 *
 * Fíjate en lo que este manejador NO hace: no decide si hay devolución, ni
 * crea la nota de abono. Lo primero lo decide la política de la escuela
 * dentro del dominio; lo segundo lo hace Facturación cuando recibe el evento.
 *
 * Si esta clase acabara creando aquí la devolución, Scheduling tendría que
 * conocer facturas, impuestos y comisiones. Ese es exactamente el acoplamiento
 * que la arquitectura está evitando.
 */
@CommandHandler(CancelClassSessionCommand)
export class CancelClassSessionHandler implements ICommandHandler<CancelClassSessionCommand> {
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(SCHOOL_SCHEDULING_POLICY_PORT) private readonly policy: SchoolSchedulingPolicyPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CancelClassSessionCommand) {
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingActorError();

    // Leer, decidir y guardar van DENTRO de la misma transacción. Fuera de
    // ella no hay contexto de escuela —las políticas RLS no dejarían ver la
    // clase— y además dos cancelaciones simultáneas podrían pisarse.
    const session = await this.uow.execute(async () => {
      const found = await this.sessions.findOrFail(SessionId.of(command.props.sessionId));
      const cancellationPolicy = await this.policy.cancellationPolicy();

      found.cancel({
        party: command.props.party,
        by: MembershipId.of(actor),
        reason: command.props.reason,
        policy: cancellationPolicy,
        now: this.clock.now(),
      });

      await this.sessions.save(found);
      return found;
    });

    // Solo después de confirmar: Facturación no debe enterarse de una
    // cancelación que podría deshacerse.
    await this.events.publish(session.pullDomainEvents());

    const cancellation = session.cancellation!;
    return {
      sessionId: session.id.value,
      refundDue: cancellation.refundDue,
      noticeHours: cancellation.noticeHours,
    };
  }
}
