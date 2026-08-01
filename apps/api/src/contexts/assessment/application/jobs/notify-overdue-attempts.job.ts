import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import { AttemptValidationOverdue } from "../../domain/events/attempt.events.js";
import {
  ATTEMPT_REPOSITORY,
  type AttemptRepository,
} from "../../domain/ports/attempt.repository.port.js";
import {
  EXERCISE_SOURCE_PORT,
  type ExerciseSourcePort,
} from "../../domain/ports/exercise-source.port.js";
import { SCHOOL_DIRECTORY, type SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";

const DAY_MS = 24 * 3_600_000;
/** «A los 7 días» (brief de la tarea 7). */
const OVERDUE_DAYS = 7;

/**
 * Aviso diario de correcciones sin firmar.
 *
 * Un ejercicio con `requiresTeacherValidation` no puede quedarse en
 * `ai_graded` para siempre: la nota sigue sin contar para el expediente
 * (regla de la ola), y pasados 7 días desde el envío nadie debería seguir
 * sin saberlo. Este trabajo detecta esos intentos y emite
 * `AttemptValidationOverdue` — quien avise al profesor de verdad (correo,
 * panel...) es cosa de quien escuche ese evento, no de `assessment`.
 *
 * Mismo patrón que `PurgeExpiredRecordingsJob` (`classroom`) y
 * `ClassReminderJob` (`notifications`): lo dispara `@nestjs/schedule`, sin
 * sesión HTTP que resuelva el tenant, así que fija su propio
 * `CLS_SCHOOL_ID` escuela por escuela antes de leer nada.
 *
 * Usa `submittedAt` como referencia de «cuánto lleva esperando», no un
 * `gradedAt` que `attempts` no tiene: `packages/db/src/schema/` no trae esa
 * columna y el brief de la tarea no pide añadirla. La corrección automática
 * ocurre casi al instante tras el envío, así que la diferencia es mínima
 * frente a inventar una columna que nadie más necesita.
 */
@Injectable()
export class NotifyOverdueAttemptsJob {
  constructor(
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(SCHOOL_DIRECTORY) private readonly schools: SchoolDirectoryPort,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
    @Inject(EXERCISE_SOURCE_PORT) private readonly exercises: ExerciseSourcePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(NotifyOverdueAttemptsJob.name) private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async run(): Promise<void> {
    const schoolIds = await this.schools.allIds();
    let notified = 0;
    for (const schoolId of schoolIds) {
      notified += await this.notifySchool(schoolId);
    }
    this.logger.info(
      `Correcciones sin firmar: ${notified} aviso(s) emitido(s) en ${schoolIds.length} escuela(s).`,
    );
  }

  private notifySchool(schoolId: string): Promise<number> {
    return this.cls.run(() => {
      this.cls.set(CLS_SCHOOL_ID, schoolId);
      return this.notify(schoolId);
    });
  }

  private async notify(schoolId: string): Promise<number> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - OVERDUE_DAYS * DAY_MS);

    const overdue = await this.uow.read(() => this.attempts.findAiGradedSubmittedBefore(cutoff));
    let notified = 0;

    for (const attempt of overdue) {
      const info = await this.uow.read(() => this.exercises.get(attempt.exerciseId));
      if (!info?.requiresTeacherValidation) continue;

      await this.events.publish([
        new AttemptValidationOverdue({
          attemptId: attempt.id.value,
          schoolId,
          exerciseId: attempt.exerciseId.value,
          studentProfileId: attempt.studentProfileId,
          submittedAt: attempt.submittedAt,
        }),
      ]);
      notified++;
    }

    return notified;
  }
}
