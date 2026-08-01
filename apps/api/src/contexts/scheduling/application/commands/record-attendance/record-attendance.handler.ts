import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import { AttendanceSheet } from "../../../domain/model/attendance.aggregate.js";
import { AttendanceId, SessionId, StudentId } from "../../../domain/model/identifiers.js";
import { SessionAlreadyClosedError } from "../../../domain/errors/scheduling.errors.js";
import {
  ATTENDANCE_REPOSITORY,
  type AttendanceRepository,
} from "../../../domain/ports/attendance.repository.port.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../../domain/ports/class-session.repository.port.js";
import {
  GROUP_ENROLLMENT_PORT,
  type GroupEnrollmentPort,
} from "../../../domain/ports/group-enrollment.port.js";
import { RecordAttendanceCommand } from "./record-attendance.command.js";

/**
 * Pasar lista.
 *
 * Coreografía, no reglas: carga la clase (para saber su grupo y su hora de
 * inicio), pide a `catalog` el padrón de matriculados a través de
 * `GroupEnrollmentPort` — un adaptador de traducción, nunca el dominio de
 * `catalog` — reconstruye la hoja con lo ya guardado, y le pide que marque.
 *
 * No cierra la clase aquí. Eso lo hace `OnAttendanceRecorded` al recibir el
 * evento, DESPUÉS de que esta transacción se confirme: si esta transacción se
 * deshiciera, nadie debería enterarse de una asistencia que no llegó a
 * guardarse.
 */
@CommandHandler(RecordAttendanceCommand)
export class RecordAttendanceHandler implements ICommandHandler<RecordAttendanceCommand> {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendance: AttendanceRepository,
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(GROUP_ENROLLMENT_PORT) private readonly enrollments: GroupEnrollmentPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RecordAttendanceCommand): Promise<{ sessionId: string; recorded: number }> {
    const now = this.clock.now();
    const sessionId = SessionId.of(command.props.sessionId);
    const actorId = this.tenant.membershipId();
    const recordedBy = actorId ? MembershipId.of(actorId) : null;

    const sheet = await this.uow.execute(async () => {
      const session = await this.sessions.findOrFail(sessionId);
      if (!session.isOpen) {
        throw new SessionAlreadyClosedError(session.id.value, session.status, "pasar lista de");
      }

      const [roster, existingEntries] = await Promise.all([
        this.enrollments.activeStudentIds(session.groupId),
        this.attendance.findEntries(sessionId),
      ]);

      const sheet = AttendanceSheet.open({
        sessionId,
        schoolId: session.schoolId,
        groupId: session.groupId,
        sessionStart: session.slot.start,
        enrolledStudentIds: roster,
        existingEntries,
      });

      for (const entry of command.props.entries) {
        const studentId = StudentId.of(entry.studentId);
        const entryId = AttendanceId.of(this.ids.generate());
        if (entry.status === "present") {
          sheet.markPresent({ entryId, studentId, now, recordedBy, note: entry.note ?? null });
        } else {
          sheet.markAbsent({ entryId, studentId, now, recordedBy, note: entry.note ?? null });
        }
      }

      await this.attendance.save(sheet);
      return sheet;
    });

    // Después de confirmar: si `OnAttendanceRecorded` cierra la clase y algo
    // más falla, la asistencia ya guardada no debe depender de ello.
    await this.events.publish(sheet.pullDomainEvents());

    return { sessionId: sheet.id.value, recorded: command.props.entries.length };
  }
}
