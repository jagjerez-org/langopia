import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionRescheduled } from "../../../scheduling/domain/events/class-session.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { NoGuardianForMinorError, resolveStudentRecipient } from "../../domain/model/recipient-resolver.js";
import { CLASS_DIRECTORY, type ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * `notifications` reacciona a que se replanifique una clase avisando a cada
 * alumno del grupo del cambio de horario.
 *
 * El evento no lleva `groupId` —solo `sessionId` (la instancia cerrada) y
 * `replacementSessionId` (la nueva)—: `ClassSession.rescheduleTo()` copia el
 * mismo grupo a la sustituta, así que basta con preguntar por el grupo de
 * `replacementSessionId` a través de `ClassDirectoryPort`.
 */
@EventsHandler(ClassSessionRescheduled)
export class OnClassSessionRescheduled implements IEventHandler<ClassSessionRescheduled> {
  constructor(
    @Inject(CLASS_DIRECTORY) private readonly classes: ClassDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnClassSessionRescheduled.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionRescheduled): Promise<void> {
    const data = event.payload();

    const groupId = await this.uow.read(() =>
      this.classes.groupIdForSession(data.replacementSessionId),
    );
    if (!groupId) {
      this.logger.error(
        `Clase ${data.replacementSessionId} replanificada, pero no se encuentra su grupo: no se avisa a nadie.`,
      );
      return;
    }

    const studentIds = await this.uow.read(() => this.classes.activeStudentIds(groupId));

    let sent = 0;
    for (const studentId of studentIds) {
      const ok = await this.notifyStudent(studentId, data);
      if (ok) sent++;
    }

    this.logger.info(
      `Clase ${data.sessionId} replanificada a ${data.replacementSessionId}: aviso enviado a ` +
        `${sent}/${studentIds.length} alumno(s) del grupo ${groupId}.`,
    );
  }

  private async notifyStudent(
    studentId: string,
    data: ReturnType<ClassSessionRescheduled["payload"]>,
  ): Promise<boolean> {
    const context = await this.uow.read(() => this.people.findStudentRecipientContext(studentId));
    if (!context) {
      this.logger.error(
        `Alumno ${studentId} matriculado, pero sin ficha: no se avisa de la clase ${data.replacementSessionId}.`,
      );
      return false;
    }

    let recipient;
    try {
      recipient = resolveStudentRecipient({
        studentId,
        isMinor: context.isMinor,
        student: context.student,
        guardians: context.guardians,
      });
    } catch (error) {
      if (error instanceof NoGuardianForMinorError) {
        this.logger.error(
          `No se avisa a ${studentId} de la clase replanificada ${data.replacementSessionId}: ${error.message}`,
        );
        return false;
      }
      throw error;
    }

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "class_rescheduled",
        data: {
          name: recipient.name,
          previousStart: data.previousStart,
          newStart: data.newStart,
          reason: data.reason,
        },
      });
      return true;
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo avisar a ${studentId} de que su clase se replanificó a ${data.replacementSessionId}: se reintentará.`,
      );
      return false;
    }
  }
}
