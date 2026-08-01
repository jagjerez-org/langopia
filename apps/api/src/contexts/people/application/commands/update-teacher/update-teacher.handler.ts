import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { TeacherId } from "../../../domain/model/identifiers.js";
import {
  TEACHER_REPOSITORY,
  type TeacherRepository,
} from "../../../domain/ports/teacher.repository.port.js";
import { UpdateTeacherCommand } from "./update-teacher.command.js";

/**
 * Edición de la ficha de un profesor.
 *
 * Igual semántica PATCH que `UpdateStudentHandler`: `tier`/`hourlyRateCents`
 * ausentes no se tocan. `Teacher.changeHourlyRate(...)` es quien decide si
 * la combinación resultante sigue siendo válida en el tramo nuevo — este
 * manejador no repite esa comprobación, solo registra el antes y el
 * después en `audit_logs`.
 */
@CommandHandler(UpdateTeacherCommand)
export class UpdateTeacherHandler implements ICommandHandler<UpdateTeacherCommand> {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: TeacherRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(command: UpdateTeacherCommand) {
    const { props } = command;
    const hasChange = props.tier !== undefined || props.hourlyRateCents !== undefined;

    const teacher = await this.uow.execute(async () => {
      const found = await this.teachers.findOrFail(TeacherId.of(props.teacherId));

      if (hasChange) {
        const before = { tier: found.hourlyRate.tier, hourlyRateCents: found.hourlyRate.cents };
        found.changeHourlyRate({ tier: props.tier, hourlyRateCents: props.hourlyRateCents });
        const after = { tier: found.hourlyRate.tier, hourlyRateCents: found.hourlyRate.cents };

        await this.teachers.save(found);
        await this.auditLog.record({
          schoolId: found.schoolId.value,
          actorKind: "user",
          actorMembershipId: this.tenant.membershipId(),
          action: "people.teacher.updated",
          entityType: "teacher",
          entityId: found.id.value,
          before,
          after,
        });
      }

      return found;
    });

    await this.events.publish(teacher.pullDomainEvents());
    return {
      teacherId: teacher.id.value,
      tier: teacher.hourlyRate.tier,
      hourlyRateCents: teacher.hourlyRate.cents,
    };
  }
}
