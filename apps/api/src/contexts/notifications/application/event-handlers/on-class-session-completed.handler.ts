import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionCompleted } from "../../../scheduling/domain/events/class-session.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { NoGuardianForMinorError, resolveStudentRecipient } from "../../domain/model/recipient-resolver.js";
import { CLASS_DIRECTORY, type ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * Encuesta post-clase: el seed la modela como algo «que se envía
 * automáticamente tras la clase» (brief de la tarea) — este manejador es ese
 * envío automático.
 *
 * Solo a quien ASISTIÓ (`attendedStudentIds`: presente o con retraso), no a
 * toda la matrícula del grupo: preguntar por la clase a quien nunca se
 * conectó no tiene sentido, y el aviso de asistencia real todavía puede no
 * existir para esta sesión si la asistencia se pasó tarde — en ese caso,
 * simplemente no hay a quién preguntar todavía.
 */
@EventsHandler(ClassSessionCompleted)
export class OnClassSessionCompleted implements IEventHandler<ClassSessionCompleted> {
  constructor(
    @Inject(CLASS_DIRECTORY) private readonly classes: ClassDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnClassSessionCompleted.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionCompleted): Promise<void> {
    const data = event.payload();

    const attendeeIds = await this.uow.read(() => this.classes.attendedStudentIds(data.sessionId));
    if (attendeeIds.length === 0) {
      this.logger.info(`Clase ${data.sessionId} completada: sin asistentes registrados, no se envía encuesta.`);
      return;
    }

    let sent = 0;
    for (const studentId of attendeeIds) {
      const ok = await this.notifyStudent(studentId, data.sessionId);
      if (ok) sent++;
    }

    this.logger.info(
      `Clase ${data.sessionId} completada: encuesta enviada a ${sent}/${attendeeIds.length} asistente(s).`,
    );
  }

  private async notifyStudent(studentId: string, sessionId: string): Promise<boolean> {
    const context = await this.uow.read(() => this.people.findStudentRecipientContext(studentId));
    if (!context) {
      this.logger.error(`Alumno ${studentId} asistió, pero sin ficha: no se envía encuesta de la clase ${sessionId}.`);
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
        this.logger.error(`No se envía la encuesta a ${studentId} de la clase ${sessionId}: ${error.message}`);
        return false;
      }
      throw error;
    }

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "post_class_survey",
        data: { name: recipient.name },
      });
      return true;
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo enviar la encuesta a ${studentId} de la clase ${sessionId}: se reintentará.`,
      );
      return false;
    }
  }
}
