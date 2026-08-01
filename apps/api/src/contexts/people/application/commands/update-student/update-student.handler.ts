import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
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
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { DateOfBirth } from "../../../domain/model/date-of-birth.vo.js";
import { StudentId } from "../../../domain/model/identifiers.js";
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from "../../../domain/ports/student.repository.port.js";
import { UpdateStudentCommand } from "./update-student.command.js";

/**
 * Edición de la ficha de un alumno.
 *
 * Semántica PATCH: un campo ausente en `props` (`undefined`) significa «no
 * tocar», y por eso se compara explícitamente contra `undefined` en vez de
 * usar `??` — `currentLevel: null` es una petición legítima (borrar el
 * nivel), no un valor por defecto. Las invariantes (menor sin tutor, alumno
 * de baja) las comprueba el propio agregado; este manejador solo decide
 * QUÉ tocar y deja el rastro de auditoría con el valor anterior y el nuevo,
 * igual que pide la Tarea 13.
 */
@CommandHandler(UpdateStudentCommand)
export class UpdateStudentHandler implements ICommandHandler<UpdateStudentCommand> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: UpdateStudentCommand) {
    const { props } = command;
    const now = this.clock.now();

    const student = await this.uow.execute(async () => {
      const found = await this.students.findOrFail(StudentId.of(props.studentId));
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      if (props.dateOfBirth !== undefined) {
        before.dateOfBirth = found.dateOfBirth.value;
        found.changeDateOfBirth({ dateOfBirth: DateOfBirth.of(props.dateOfBirth), now });
        after.dateOfBirth = found.dateOfBirth.value;
      }

      if (props.currentLevel !== undefined) {
        before.currentLevel = found.currentLevel;
        found.changeLevel(props.currentLevel as CefrLevel | null);
        after.currentLevel = found.currentLevel;
      }

      if (Object.keys(after).length > 0) {
        await this.students.save(found);
        await this.auditLog.record({
          schoolId: found.schoolId.value,
          actorKind: "user",
          actorMembershipId: this.tenant.membershipId(),
          action: "people.student.updated",
          entityType: "student",
          entityId: found.id.value,
          before,
          after,
        });
      }

      return found;
    });

    await this.events.publish(student.pullDomainEvents());
    return {
      studentId: student.id.value,
      guardianRequired: student.guardianRequired,
      currentLevel: student.currentLevel,
    };
  }
}
