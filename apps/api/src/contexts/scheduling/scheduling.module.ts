import { Module } from "@nestjs/common";
import { CancelClassSessionHandler } from "./application/commands/cancel-class-session/cancel-class-session.handler.js";
import { ImportAttendanceHandler } from "./application/commands/import-attendance/import-attendance.handler.js";
import { RecordAttendanceHandler } from "./application/commands/record-attendance/record-attendance.handler.js";
import { RescheduleClassSessionHandler } from "./application/commands/reschedule-class-session/reschedule-class-session.handler.js";
import { ScheduleClassSessionHandler } from "./application/commands/schedule-class-session/schedule-class-session.handler.js";
import { OnAttendanceRecorded } from "./application/event-handlers/on-attendance-recorded.handler.js";
import { GetCancellationPreviewHandler } from "./application/queries/get-cancellation-preview/get-cancellation-preview.handler.js";
import { GetGroupRosterHandler } from "./application/queries/get-group-roster/get-group-roster.handler.js";
import { GetSchoolTimezoneHandler } from "./application/queries/get-school-timezone/get-school-timezone.handler.js";
import { GetTeacherOccupancyHandler } from "./application/queries/get-teacher-occupancy/get-teacher-occupancy.handler.js";
import { GetWeeklyAgendaHandler } from "./application/queries/get-weekly-agenda/get-weekly-agenda.handler.js";
import { SCHEDULING_READ_MODEL } from "./application/ports/scheduling-read-model.port.js";
import { ATTENDANCE_REPOSITORY } from "./domain/ports/attendance.repository.port.js";
import { CLASS_SESSION_REPOSITORY } from "./domain/ports/class-session.repository.port.js";
import { GROUP_ENROLLMENT_PORT } from "./domain/ports/group-enrollment.port.js";
import { SCHOOL_SCHEDULING_POLICY_PORT } from "./domain/ports/school-scheduling-policy.port.js";
import { TEACHER_AVAILABILITY_PORT } from "./domain/ports/teacher-availability.port.js";
import { CatalogGroupEnrollmentAdapter } from "./infrastructure/acl/catalog-group-enrollment.adapter.js";
import { PeopleTeacherAvailabilityAdapter } from "./infrastructure/acl/people-teacher-availability.adapter.js";
import { SchoolSchedulingPolicyAdapter } from "./infrastructure/acl/school-scheduling-policy.adapter.js";
import { SchedulingController } from "./infrastructure/http/scheduling.controller.js";
import { DrizzleAttendanceRepository } from "./infrastructure/persistence/drizzle-attendance.repository.js";
import { DrizzleClassSessionRepository } from "./infrastructure/persistence/drizzle-class-session.repository.js";
import { DrizzleGroupEnrollmentRepository } from "./infrastructure/persistence/drizzle-group-enrollment.repository.js";
import { DrizzleSchedulingReadModel } from "./infrastructure/persistence/drizzle-scheduling-read-model.js";
import { DrizzleSchoolTimezoneRepository } from "./infrastructure/persistence/drizzle-school-timezone.repository.js";
import { DrizzleTeacherAvailabilityRepository } from "./infrastructure/persistence/drizzle-teacher-availability.repository.js";

const commandHandlers = [
  ScheduleClassSessionHandler,
  CancelClassSessionHandler,
  RescheduleClassSessionHandler,
  RecordAttendanceHandler,
  ImportAttendanceHandler,
];

const queryHandlers = [
  GetWeeklyAgendaHandler,
  GetTeacherOccupancyHandler,
  GetSchoolTimezoneHandler,
  GetGroupRosterHandler,
  GetCancellationPreviewHandler,
];

const eventHandlers = [OnAttendanceRecorded];

/**
 * Contexto acotado de programación de clases.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada puerto,
 * y nada de esto sale fuera. Otro contexto que necesite algo de aquí lo pide
 * por su propio puerto o escucha un evento — nunca importa una clase de este
 * directorio.
 */
@Module({
  controllers: [SchedulingController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    DrizzleTeacherAvailabilityRepository,
    DrizzleSchoolTimezoneRepository,
    DrizzleGroupEnrollmentRepository,
    { provide: CLASS_SESSION_REPOSITORY, useClass: DrizzleClassSessionRepository },
    { provide: ATTENDANCE_REPOSITORY, useClass: DrizzleAttendanceRepository },
    { provide: SCHEDULING_READ_MODEL, useClass: DrizzleSchedulingReadModel },
    { provide: TEACHER_AVAILABILITY_PORT, useClass: PeopleTeacherAvailabilityAdapter },
    { provide: SCHOOL_SCHEDULING_POLICY_PORT, useClass: SchoolSchedulingPolicyAdapter },
    { provide: GROUP_ENROLLMENT_PORT, useClass: CatalogGroupEnrollmentAdapter },
  ],
})
export class SchedulingModule {}
