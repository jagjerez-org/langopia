import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { StudentEnrolled } from "../../../people/domain/events/student.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { NoGuardianForMinorError, resolveStudentRecipient } from "../../domain/model/recipient-resolver.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * `notifications` reacciona a que se matricule un alumno enviándole la
 * bienvenida — o a su tutor, si es menor (`resolveStudentRecipient`, el
 * resolutor de destinatario e idioma del paso 4 del brief).
 *
 *   · `people` NO sabe que `notifications` existe. Emitió un hecho y siguió.
 *   · `people` tampoco puede impedir la matrícula por esto: si pudiera, no
 *     sería un evento, sería una llamada síncrona por un puerto — y una caída
 *     del proveedor de correo bloquearía dar de alta alumnado.
 *
 * Lo único que se importa de `people` es la CLASE DEL EVENTO — su contrato
 * público — nunca su agregado `Student` ni su repositorio.
 */
@EventsHandler(StudentEnrolled)
export class OnStudentEnrolled implements IEventHandler<StudentEnrolled> {
  constructor(
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnStudentEnrolled.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: StudentEnrolled): Promise<void> {
    const { studentId } = event.payload();

    const context = await this.uow.read(() => this.people.findStudentRecipientContext(studentId));
    if (!context) {
      this.logger.error(
        `Alumno ${studentId} matriculado, pero no se encuentra su ficha: no se envía bienvenida.`,
      );
      return;
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
        this.logger.error(`No se envía la bienvenida de ${studentId}: ${error.message}`);
        return;
      }
      throw error;
    }

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "student_welcome",
        data: { name: recipient.name },
      });
      this.logger.info(`Bienvenida enviada por la matrícula del alumno ${studentId}.`);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo enviar la bienvenida del alumno ${studentId}: se reintentará.`,
      );
    }
  }
}
