import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { ImpersonationId } from "../../../domain/model/impersonation.aggregate.js";
import {
  IMPERSONATION_REPOSITORY,
  type ImpersonationRepositoryPort,
} from "../../../domain/ports/impersonation-repository.port.js";
import { EndImpersonationCommand } from "./end-impersonation.command.js";

/**
 * Termina una impersonación, a mano.
 *
 * Quien la termina no tiene por qué ser quien la empezó — cualquiera con una
 * impersonación activa en su CLS puede cerrarla (`ImpersonationController`
 * resuelve el `impersonationId` desde ahí, nunca del cuerpo de la
 * petición): es el mismo agregado, y `end()` ya rechaza cerrar dos veces.
 *
 * La caducidad automática (30 minutos) NO pasa por aquí: no hace falta un
 * cierre explícito para que el rastro quede completo, ver el comentario de
 * `Impersonation.end` y de la tabla `impersonations` en el esquema.
 */
@CommandHandler(EndImpersonationCommand)
export class EndImpersonationHandler implements ICommandHandler<EndImpersonationCommand> {
  constructor(
    @Inject(IMPERSONATION_REPOSITORY) private readonly repository: ImpersonationRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: EndImpersonationCommand) {
    const now = this.clock.now();

    const impersonation = await this.uow.execute(async () => {
      const found = await this.repository.findById(ImpersonationId.of(command.props.impersonationId));
      if (!found) throw new NotFoundError("impersonación", command.props.impersonationId);

      found.end(now);
      await this.repository.save(found);

      await this.auditLog.record({
        schoolId: found.schoolId,
        actorKind: "impersonation",
        actorMembershipId: found.targetMembershipId,
        impersonatorMembershipId: found.impersonatorMembershipId,
        action: "iam.impersonation.ended",
        entityType: "impersonation",
        entityId: found.id.value,
        after: {
          endedAt: found.endedAt?.toISOString(),
          durationSeconds: Math.round(
            ((found.endedAt?.getTime() ?? now.getTime()) - found.startedAt.getTime()) / 1000,
          ),
        },
      });

      return found;
    });

    await this.events.publish(impersonation.pullDomainEvents());

    return {
      impersonationId: impersonation.id.value,
      endedAt: impersonation.endedAt!.toISOString(),
      durationSeconds: Math.round(
        (impersonation.endedAt!.getTime() - impersonation.startedAt.getTime()) / 1000,
      ),
    };
  }
}
