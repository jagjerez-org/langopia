import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionCanceled } from "../../../scheduling/domain/events/class-session.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { NoGuardianForMinorError, resolveStudentRecipient } from "../../domain/model/recipient-resolver.js";
import { CLASS_DIRECTORY, type ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * `notifications` reacciona a que se cancele una clase avisando a cada
 * alumno matriculado (o a su tutor, si es menor) del grupo.
 *
 * `billing` YA escucha este mismo evento (`OnClassSessionCanceled`, para
 * abrir la devolución) — de ahí el sufijo `Email` en el nombre: dos
 * contextos distintos pueden suscribirse al mismo evento sin coordinarse
 * (es la gracia de que sea un evento y no una llamada), pero un mismo nombre
 * de clase en dos sitios haría indistinguibles sus líneas de registro
 * (`@InjectPinoLogger` usa el nombre de la clase como `context`).
 *
 * Mismo reparto que esa: Scheduling no sabe que esto existe, no puede
 * impedir la cancelación por esto, y lo único que se importa de su contrato
 * es la clase del evento.
 *
 * Un fallo al avisar a un alumno no impide avisar al resto: cada envío se
 * intenta y se registra por separado.
 */
@EventsHandler(ClassSessionCanceled)
export class OnClassSessionCanceledEmail implements IEventHandler<ClassSessionCanceled> {
  constructor(
    @Inject(CLASS_DIRECTORY) private readonly classes: ClassDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnClassSessionCanceledEmail.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionCanceled): Promise<void> {
    const data = event.payload();

    const studentIds = await this.uow.read(() => this.classes.activeStudentIds(data.groupId));
    if (studentIds.length === 0) {
      this.logger.info(`Clase ${data.sessionId} cancelada: ningún alumno activo en el grupo ${data.groupId}.`);
      return;
    }

    let sent = 0;
    for (const studentId of studentIds) {
      const ok = await this.notifyStudent(studentId, data.sessionId, data.start, data.reason);
      if (ok) sent++;
    }

    this.logger.info(
      `Clase ${data.sessionId} cancelada: aviso enviado a ${sent}/${studentIds.length} alumno(s) del grupo ${data.groupId}.`,
    );
  }

  private async notifyStudent(
    studentId: string,
    sessionId: string,
    startIso: string,
    reason: string,
  ): Promise<boolean> {
    const context = await this.uow.read(() => this.people.findStudentRecipientContext(studentId));
    if (!context) {
      this.logger.error(`Alumno ${studentId} matriculado, pero sin ficha: no se avisa de la clase ${sessionId}.`);
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
        this.logger.error(`No se avisa a ${studentId} de la clase ${sessionId}: ${error.message}`);
        return false;
      }
      throw error;
    }

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "class_canceled",
        data: { name: recipient.name, startsAt: startIso, reason },
      });
      return true;
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo avisar a ${studentId} de que su clase ${sessionId} se canceló: se reintentará.`,
      );
      return false;
    }
  }
}
