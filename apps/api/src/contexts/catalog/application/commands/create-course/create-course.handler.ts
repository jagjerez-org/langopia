import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import type { CourseModality } from "../../../domain/model/course-modality.js";
import { Course } from "../../../domain/model/course.aggregate.js";
import { CourseId } from "../../../domain/model/identifiers.js";
import {
  COURSE_REPOSITORY,
  type CourseRepository,
} from "../../../domain/ports/course.repository.port.js";
import {
  SCHOOL_LOCALE_PORT,
  type SchoolLocalePort,
} from "../../../domain/ports/school-locale.port.js";
import { CreateCourseCommand } from "./create-course.command.js";

/**
 * Alta de un curso.
 *
 * El nombre por defecto de la escuela se pregunta aquí —vía
 * `SchoolLocalePort`, dentro de la transacción— porque `Course.create()` lo
 * necesita para exigir que exista al menos esa traducción, y un agregado no
 * hace consultas.
 */
@CommandHandler(CreateCourseCommand)
export class CreateCourseHandler implements ICommandHandler<CreateCourseCommand> {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository,
    @Inject(SCHOOL_LOCALE_PORT) private readonly schoolLocale: SchoolLocalePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateCourseCommand): Promise<{ courseId: string }> {
    const { props } = command;

    const course = await this.uow.execute(async () => {
      const schoolDefaultLocale = await this.schoolLocale.defaultLocale();

      const created = Course.create({
        id: CourseId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        code: props.code,
        language: props.language,
        level: props.level as CefrLevel,
        modality: props.modality as CourseModality,
        totalSessions: props.totalSessions ?? 50,
        sessionMinutes: props.sessionMinutes ?? 60,
        maxStudents: props.maxStudents ?? 5,
        priceCents: props.priceCents,
        currency: props.currency ?? "EUR",
        translations: props.translations.map((t) => ({
          locale: t.locale,
          name: t.name,
          description: t.description ?? null,
        })),
        schoolDefaultLocale,
      });

      await this.courses.save(created);
      return created;
    });

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería haberse enterado de un curso que no existe.
    await this.events.publish(course.pullDomainEvents());

    return { courseId: course.id.value };
  }
}
