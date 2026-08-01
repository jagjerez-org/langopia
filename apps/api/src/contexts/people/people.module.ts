import { Module } from "@nestjs/common";
import { EnrolStudentHandler } from "./application/commands/enrol-student/enrol-student.handler.js";
import { CaptureLeadHandler } from "./application/commands/capture-lead/capture-lead.handler.js";
import { ConvertLeadHandler } from "./application/commands/convert-lead/convert-lead.handler.js";
import { GrantConsentHandler } from "./application/commands/grant-consent/grant-consent.handler.js";
import { HireTeacherHandler } from "./application/commands/hire-teacher/hire-teacher.handler.js";
import { ImportStudentsCommitHandler } from "./application/commands/import-students/import-students-commit.handler.js";
import { ImportStudentsPreviewHandler } from "./application/commands/import-students/import-students-preview.handler.js";
import { LeaveStudentHandler } from "./application/commands/leave-student/leave-student.handler.js";
import { ReleaseTeacherHandler } from "./application/commands/release-teacher/release-teacher.handler.js";
import { SetAvailabilityHandler } from "./application/commands/set-availability/set-availability.handler.js";
import { UpdateStudentHandler } from "./application/commands/update-student/update-student.handler.js";
import { UpdateTeacherHandler } from "./application/commands/update-teacher/update-teacher.handler.js";
import { PEOPLE_READ_MODEL } from "./application/ports/people-read-model.port.js";
import { LEAD_CAPTURE_TENANT_RUNNER } from "./application/ports/lead-capture-tenant-runner.port.js";
import { PUBLISHED_SITE_RESOLVER } from "./application/ports/published-site-resolver.port.js";
import { ListLeadsHandler } from "./application/queries/list-leads/list-leads.handler.js";
import { ListStudentsHandler } from "./application/queries/list-students/list-students.handler.js";
import { ListTeachersHandler } from "./application/queries/list-teachers/list-teachers.handler.js";
import { MEMBERSHIP_PROVISIONING_PORT } from "./domain/ports/membership-provisioning.port.js";
import { STUDENT_REPOSITORY } from "./domain/ports/student.repository.port.js";
import { LEAD_REPOSITORY } from "./domain/ports/lead.repository.port.js";
import { TEACHER_REPOSITORY } from "./domain/ports/teacher.repository.port.js";
import { IamMembershipProvisioningAdapter } from "./infrastructure/acl/iam-membership-provisioning.adapter.js";
import { ImportsController } from "./infrastructure/http/imports.controller.js";
import { LeadsController, PublicLeadsController } from "./infrastructure/http/leads.controller.js";
import { StudentsController } from "./infrastructure/http/students.controller.js";
import { TeachersController } from "./infrastructure/http/teachers.controller.js";
import { DrizzleMembershipRepository } from "./infrastructure/persistence/drizzle-membership.repository.js";
import { DrizzleLeadRepository } from "./infrastructure/persistence/drizzle-lead.repository.js";
import { DrizzlePeopleReadModel } from "./infrastructure/persistence/drizzle-people-read-model.js";
import { DrizzlePublishedSiteResolver } from "./infrastructure/persistence/drizzle-published-site-resolver.js";
import { DrizzleStudentRepository } from "./infrastructure/persistence/drizzle-student.repository.js";
import { DrizzleTeacherRepository } from "./infrastructure/persistence/drizzle-teacher.repository.js";
import { MEMBERSHIP_REPOSITORY } from "./infrastructure/persistence/membership.repository.js";
import { ClsLeadCaptureTenantRunner } from "./infrastructure/tenant/cls-lead-capture-tenant-runner.js";

const commandHandlers = [
  EnrolStudentHandler,
  LeaveStudentHandler,
  GrantConsentHandler,
  UpdateStudentHandler,
  HireTeacherHandler,
  SetAvailabilityHandler,
  ReleaseTeacherHandler,
  UpdateTeacherHandler,
  ImportStudentsPreviewHandler,
  ImportStudentsCommitHandler,
  CaptureLeadHandler,
  ConvertLeadHandler,
];
const queryHandlers = [ListStudentsHandler, ListTeachersHandler, ListLeadsHandler];

/**
 * Contexto acotado de alumnado.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada
 * puerto, y nada de esto sale fuera. Otro contexto que necesite algo de aquí
 * lo pide por su propio puerto o escucha un evento — nunca importa una clase
 * de este directorio.
 */
@Module({
  controllers: [StudentsController, TeachersController, ImportsController, LeadsController, PublicLeadsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: STUDENT_REPOSITORY, useClass: DrizzleStudentRepository },
    { provide: LEAD_REPOSITORY, useClass: DrizzleLeadRepository },
    { provide: TEACHER_REPOSITORY, useClass: DrizzleTeacherRepository },
    { provide: PEOPLE_READ_MODEL, useClass: DrizzlePeopleReadModel },
    { provide: MEMBERSHIP_REPOSITORY, useClass: DrizzleMembershipRepository },
    { provide: MEMBERSHIP_PROVISIONING_PORT, useClass: IamMembershipProvisioningAdapter },
    { provide: PUBLISHED_SITE_RESOLVER, useClass: DrizzlePublishedSiteResolver },
    { provide: LEAD_CAPTURE_TENANT_RUNNER, useClass: ClsLeadCaptureTenantRunner },
  ],
})
export class PeopleModule {}
