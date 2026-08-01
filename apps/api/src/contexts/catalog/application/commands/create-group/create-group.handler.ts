import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
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
import { Group } from "../../../domain/model/group.aggregate.js";
import { CourseId, GroupId, TeacherId } from "../../../domain/model/identifiers.js";
import {
  COURSE_REPOSITORY,
  type CourseRepository,
} from "../../../domain/ports/course.repository.port.js";
import {
  GROUP_REPOSITORY,
  type GroupRepository,
} from "../../../domain/ports/group.repository.port.js";
import { CreateGroupCommand } from "./create-group.command.js";

/** Fecha `YYYY-MM-DD` a medianoche UTC. El DTO ya valida el formato. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/**
 * Alta de un grupo.
 *
 * La capacidad NO la elige quien crea el grupo: se hereda siempre del curso
 * (`Course.maxStudents`), que a su vez fuerza 1 para un curso privado. Es la
 * forma más simple de que «un curso privado tiene capacidad 1» sea verdad
 * también aquí, sin repetir la regla.
 */
@CommandHandler(CreateGroupCommand)
export class CreateGroupHandler implements ICommandHandler<CreateGroupCommand> {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly courses: CourseRepository,
    @Inject(GROUP_REPOSITORY) private readonly groups: GroupRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateGroupCommand): Promise<{ groupId: string }> {
    const { props } = command;

    const group = await this.uow.execute(async () => {
      const course = await this.courses.findOrFail(CourseId.of(props.courseId));

      const created = Group.create({
        id: GroupId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        courseId: course.id,
        teacherId: props.teacherId ? TeacherId.of(props.teacherId) : null,
        name: props.name,
        capacity: course.maxStudents,
        startsOn: dateOnlyToUtc(props.startsOn),
        endsOn: props.endsOn ? dateOnlyToUtc(props.endsOn) : null,
      });

      await this.groups.save(created);
      return created;
    });

    await this.events.publish(group.pullDomainEvents());

    return { groupId: group.id.value };
  }
}
