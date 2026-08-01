import { Module } from "@nestjs/common";
import { OnClassSessionCanceledEmail } from "./application/event-handlers/on-class-session-canceled.handler.js";
import { OnClassSessionCompleted } from "./application/event-handlers/on-class-session-completed.handler.js";
import { OnClassSessionRescheduled } from "./application/event-handlers/on-class-session-rescheduled.handler.js";
import { OnImpersonationStarted } from "./application/event-handlers/on-impersonation-started.handler.js";
import { OnInvoiceIssued } from "./application/event-handlers/on-invoice-issued.handler.js";
import { OnPaymentFailed } from "./application/event-handlers/on-payment-failed.handler.js";
import { OnStudentEnrolled } from "./application/event-handlers/on-student-enrolled.handler.js";
import { ClassReminderJob } from "./application/jobs/class-reminder.job.js";
import { CLASS_DIRECTORY } from "./domain/ports/class-directory.port.js";
import { INVOICE_DIRECTORY } from "./domain/ports/invoice-directory.port.js";
import { MAILER } from "./domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY } from "./domain/ports/people-directory.port.js";
import { SCHOOL_DIRECTORY } from "./domain/ports/school-directory.port.js";
import { ResendMailerAdapter } from "./infrastructure/external/resend-mailer.adapter.js";
import { NotificationsCronController } from "./infrastructure/http/cron.controller.js";
import { DrizzleClassDirectoryRepository } from "./infrastructure/persistence/drizzle-class-directory.repository.js";
import { DrizzleInvoiceDirectoryRepository } from "./infrastructure/persistence/drizzle-invoice-directory.repository.js";
import { DrizzlePeopleDirectoryRepository } from "./infrastructure/persistence/drizzle-people-directory.repository.js";
import { DrizzleSchoolDirectoryRepository } from "./infrastructure/persistence/drizzle-school-directory.repository.js";

const eventHandlers = [
  OnStudentEnrolled,
  OnClassSessionCanceledEmail,
  OnClassSessionRescheduled,
  OnClassSessionCompleted,
  OnInvoiceIssued,
  OnPaymentFailed,
  OnImpersonationStarted,
];

/**
 * Contexto acotado de notificaciones por correo.
 *
 * Sin rutas de negocio: este contexto SOLO escucha eventos de dominio de
 * otros (`scheduling`, `billing`, `people`) y un trabajo programado, nunca
 * responde a la acción de un usuario — es la forma en que «si mañana quitas
 * el correo, nada más se entera» (brief de la tarea) se sostiene en el
 * código y no solo en la intención: nada exporta nada de aquí, y nada más
 * importa este módulo (`app.module.ts` se limita a montarlo). El único
 * controlador (`NotificationsCronController`) no es de negocio: es la
 * entrada HTTP que Vercel Cron necesita para disparar el recordatorio en
 * serverless, donde `@nestjs/schedule` no corre.
 *
 * `iam.member.invited` queda fuera a propósito: ese evento no existe
 * todavía (depende de la tarea de invitaciones), así que no hay «Invitación
 * a la escuela» que escuchar. Ver el informe de la tarea.
 */
@Module({
  controllers: [NotificationsCronController],
  providers: [
    ...eventHandlers,
    ClassReminderJob,
    { provide: MAILER, useClass: ResendMailerAdapter },
    { provide: PEOPLE_DIRECTORY, useClass: DrizzlePeopleDirectoryRepository },
    { provide: CLASS_DIRECTORY, useClass: DrizzleClassDirectoryRepository },
    { provide: INVOICE_DIRECTORY, useClass: DrizzleInvoiceDirectoryRepository },
    { provide: SCHOOL_DIRECTORY, useClass: DrizzleSchoolDirectoryRepository },
  ],
})
export class NotificationsModule {}
