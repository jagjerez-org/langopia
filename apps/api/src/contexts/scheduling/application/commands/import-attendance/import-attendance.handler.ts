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
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
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
import { ImportAttendanceCommand } from "./import-attendance.command.js";

/**
 * Importa el lote del informe de asistencia del proveedor de vídeo.
 *
 * Misma coreografía que `RecordAttendanceHandler` — cargar la clase, pedir el
 * padrón, reconstruir la hoja, guardar, publicar después de confirmar — solo
 * que aquí se usa `importFrom` en vez de `markPresent`/`markAbsent`, así que
 * el origen que queda grabado es siempre «importado».
 */
@CommandHandler(ImportAttendanceCommand)
export class ImportAttendanceHandler implements ICommandHandler<ImportAttendanceCommand> {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendance: AttendanceRepository,
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(GROUP_ENROLLMENT_PORT) private readonly enrollments: GroupEnrollmentPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: ImportAttendanceCommand): Promise<{ sessionId: string; imported: number }> {
    const now = this.clock.now();
    const sessionId = SessionId.of(command.props.sessionId);

    const sheet = await this.uow.execute(async () => {
      const session = await this.sessions.findOrFail(sessionId);
      if (!session.isOpen) {
        throw new SessionAlreadyClosedError(session.id.value, session.status, "importar asistencia de");
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

      sheet.importFrom(
        command.props.entries.map((entry) => ({
          entryId: AttendanceId.of(this.ids.generate()),
          studentId: StudentId.of(entry.studentId),
          status: entry.status,
          joinedAt: entry.joinedAt ? new Date(entry.joinedAt) : null,
          leftAt: entry.leftAt ? new Date(entry.leftAt) : null,
          minutesPresent: entry.minutesPresent ?? null,
        })),
        { now },
      );

      await this.attendance.save(sheet);
      return sheet;
    });

    await this.events.publish(sheet.pullDomainEvents());

    return { sessionId: sheet.id.value, imported: command.props.entries.length };
  }
}
