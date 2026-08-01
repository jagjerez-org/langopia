import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { AttemptId } from "../../../domain/model/identifiers.js";
import {
  ATTEMPT_REPOSITORY,
  type AttemptRepository,
} from "../../../domain/ports/attempt.repository.port.js";
import { ValidateAttemptCommand } from "./validate-attempt.command.js";

/** Igual que en `CancelClassSessionHandler` (`scheduling`): sin actor conocido, no hay quién firme. */
export class MissingActorError extends DomainError {
  readonly code = "missing_actor";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Validar un intento requiere saber quién lo valida.");
  }
}

/**
 * Manejador del comando.
 *
 * Sin reglas propias: resuelve quién firma (la membresía autenticada, nunca
 * un campo del comando) y le pide a `Attempt.validate()` que haga el resto.
 */
@CommandHandler(ValidateAttemptCommand)
export class ValidateAttemptHandler implements ICommandHandler<ValidateAttemptCommand> {
  constructor(
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ValidateAttemptCommand): Promise<{ attemptId: string; status: string }> {
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingActorError();
    const now = this.clock.now();

    const attempt = await this.uow.execute(async () => {
      const found = await this.attempts.findOrFail(AttemptId.of(command.props.attemptId));
      found.validate({
        teacherScore: command.props.teacherScore,
        teacherFeedback: command.props.teacherFeedback ?? null,
        membershipId: actor,
        now,
      });
      await this.attempts.save(found);
      return found;
    });

    await this.events.publish(attempt.pullDomainEvents());
    return { attemptId: attempt.id.value, status: attempt.status };
  }
}
