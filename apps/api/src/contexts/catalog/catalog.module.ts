import { Module } from "@nestjs/common";
import { CreateCourseHandler } from "./application/commands/create-course/create-course.handler.js";
import { CreateGroupHandler } from "./application/commands/create-group/create-group.handler.js";
import { EnrolStudentInGroupHandler } from "./application/commands/enrol-student-in-group/enrol-student-in-group.handler.js";
import { CATALOG_READ_MODEL } from "./application/ports/catalog-read-model.port.js";
import { GetGroupHandler } from "./application/queries/get-group/get-group.handler.js";
import { GetSchoolLocalesHandler } from "./application/queries/get-school-locales/get-school-locales.handler.js";
import { ListCoursesHandler } from "./application/queries/list-courses/list-courses.handler.js";
import { COURSE_REPOSITORY } from "./domain/ports/course.repository.port.js";
import { GROUP_REPOSITORY } from "./domain/ports/group.repository.port.js";
import { SCHOOL_LOCALE_PORT } from "./domain/ports/school-locale.port.js";
import { STUDENT_STATUS_PORT } from "./domain/ports/student-status.port.js";
import { PeopleStudentStatusAdapter } from "./infrastructure/acl/people-student-status.adapter.js";
import { SchoolCatalogLocaleAdapter } from "./infrastructure/acl/school-catalog-locale.adapter.js";
import { CatalogController } from "./infrastructure/http/catalog.controller.js";
import { DrizzleCatalogReadModel } from "./infrastructure/persistence/drizzle-catalog-read-model.js";
import { DrizzleCourseRepository } from "./infrastructure/persistence/drizzle-course.repository.js";
import { DrizzleGroupRepository } from "./infrastructure/persistence/drizzle-group.repository.js";
import { DrizzleSchoolLocaleRepository } from "./infrastructure/persistence/drizzle-school-locale.repository.js";
import { DrizzleStudentStatusRepository } from "./infrastructure/persistence/drizzle-student-status.repository.js";

const commandHandlers = [CreateCourseHandler, CreateGroupHandler, EnrolStudentInGroupHandler];
const queryHandlers = [ListCoursesHandler, GetGroupHandler, GetSchoolLocalesHandler];

/**
 * Contexto acotado de catálogo formativo: cursos, grupos y matrículas.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada puerto,
 * y nada de esto sale fuera.
 */
@Module({
  controllers: [CatalogController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    DrizzleStudentStatusRepository,
    DrizzleSchoolLocaleRepository,
    { provide: COURSE_REPOSITORY, useClass: DrizzleCourseRepository },
    { provide: GROUP_REPOSITORY, useClass: DrizzleGroupRepository },
    { provide: STUDENT_STATUS_PORT, useClass: PeopleStudentStatusAdapter },
    { provide: SCHOOL_LOCALE_PORT, useClass: SchoolCatalogLocaleAdapter },
    { provide: CATALOG_READ_MODEL, useClass: DrizzleCatalogReadModel },
  ],
})
export class CatalogModule {}
