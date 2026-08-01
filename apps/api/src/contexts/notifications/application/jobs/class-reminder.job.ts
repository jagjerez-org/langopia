import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  NoGuardianForMinorError,
  resolveStudentRecipient,
} from "../../domain/model/recipient-resolver.js";
import {
  CLASS_DIRECTORY,
  type ClassDirectoryPort,
  type UpcomingSession,
} from "../../domain/ports/class-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";
import { SCHOOL_DIRECTORY, type SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";

const REMINDER_LEAD_HOURS = 24;
const WINDOW_HOURS = 1;

/**
 * Recordatorio de clase, 24 horas antes (paso 7 del brief; no lo dispara
 * ningún evento, es «trabajo programado»).
 *
 * Corre cada hora y mira una ventana de una hora que empieza 24 horas por
 * delante: cada clase cae en la ventana de una única ejecución según avanza
 * el reloj, así que no hace falta una columna `reminder_sent_at` para no
 * avisar dos veces (`packages/db/src/schema/` no tiene ninguna, y el brief
 * de la ola prohíbe inventar columnas). El coste es aceptar que un reinicio
 * justo dentro de esa hora puede perder el aviso de esa clase concreta — muy
 * poco, comparado con inventar una columna para una tarea que ni la pide.
 *
 * Mismo patrón que `PurgeExpiredRecordingsJob` de `classroom`: lo dispara
 * `@nestjs/schedule`, sin sesión HTTP que resuelva el tenant, así que fija su
 * propio `CLS_SCHOOL_ID` escuela por escuela antes de leer nada.
 */
@Injectable()
export class ClassReminderJob {
  constructor(
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(SCHOOL_DIRECTORY) private readonly schools: SchoolDirectoryPort,
    @Inject(CLASS_DIRECTORY) private readonly classes: ClassDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(ClassReminderJob.name) private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const schoolIds = await this.schools.allIds();
    let sent = 0;
    for (const schoolId of schoolIds) {
      sent += await this.remindSchool(schoolId);
    }
    this.logger.info(
      `Recordatorio de clase: ${sent} aviso(s) enviado(s) en ${schoolIds.length} escuela(s).`,
    );
  }

  private remindSchool(schoolId: string): Promise<number> {
    return this.cls.run(() => {
      this.cls.set(CLS_SCHOOL_ID, schoolId);
      return this.remind();
    });
  }

  private async remind(): Promise<number> {
    const now = this.clock.now();
    const windowStart = new Date(now.getTime() + REMINDER_LEAD_HOURS * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

    const sessions = await this.uow.read(() =>
      this.classes.scheduledSessionsStartingBetween(windowStart, windowEnd),
    );

    let sent = 0;
    for (const session of sessions) {
      const studentIds = await this.uow.read(() => this.classes.activeStudentIds(session.groupId));
      for (const studentId of studentIds) {
        const ok = await this.notifyStudent(studentId, session);
        if (ok) sent++;
      }
    }
    return sent;
  }

  private async notifyStudent(studentId: string, session: UpcomingSession): Promise<boolean> {
    const context = await this.uow.read(() => this.people.findStudentRecipientContext(studentId));
    if (!context) {
      this.logger.error(
        `Alumno ${studentId} matriculado, pero sin ficha: no se recuerda la clase ${session.sessionId}.`,
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
        this.logger.error(`No se recuerda la clase ${session.sessionId} a ${studentId}: ${error.message}`);
        return false;
      }
      throw error;
    }

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "class_reminder",
        data: { name: recipient.name, startsAt: session.start.toISOString() },
      });
      return true;
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo enviar el recordatorio de la clase ${session.sessionId} a ${studentId}: se reintentará.`,
      );
      return false;
    }
  }
}
