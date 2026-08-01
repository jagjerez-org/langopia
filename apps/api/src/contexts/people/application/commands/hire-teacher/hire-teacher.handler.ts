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
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { HourlyRate } from "../../../domain/model/hourly-rate.vo.js";
import { TeacherId } from "../../../domain/model/identifiers.js";
import { Teacher } from "../../../domain/model/teacher.aggregate.js";
import {
  MEMBERSHIP_PROVISIONING_PORT,
  type MembershipProvisioningPort,
} from "../../../domain/ports/membership-provisioning.port.js";
import {
  TEACHER_REPOSITORY,
  type TeacherRepository,
} from "../../../domain/ports/teacher.repository.port.js";
import { HireTeacherCommand } from "./hire-teacher.command.js";

/**
 * Alta de un profesor.
 *
 * Igual patrón que `EnrolStudentHandler`: aprovisiona la membresía a través
 * del puerto anticorrupción hacia `iam` (no crea usuarios aquí) y guarda
 * dentro de la misma transacción, para que la ficha y su membresía se
 * confirmen o se deshagan juntas. Es exactamente lo que hace que el profesor
 * que da clase en dos escuelas funcione: el correo resuelve al mismo usuario
 * global, y cada escuela obtiene su propia membresía y su propia ficha.
 */
@CommandHandler(HireTeacherCommand)
export class HireTeacherHandler implements ICommandHandler<HireTeacherCommand> {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: TeacherRepository,
    @Inject(MEMBERSHIP_PROVISIONING_PORT) private readonly members: MembershipProvisioningPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: HireTeacherCommand) {
    const { props } = command;
    const hourlyRate = HourlyRate.of(props.tier, props.hourlyRateCents);

    const teacher = await this.uow.execute(async () => {
      const membershipId = await this.members.provisionTeacher({
        name: props.name,
        email: props.email,
        locale: props.locale ?? null,
      });

      const hired = Teacher.hire({
        id: TeacherId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        membershipId: MembershipId.of(membershipId),
        hourlyRate,
        contractedHoursPerWeek: props.contractedHoursPerWeek,
        hiredAt: new Date(`${props.hiredAt}T00:00:00Z`),
      });

      await this.teachers.save(hired);
      return hired;
    });

    await this.events.publish(teacher.pullDomainEvents());
    return { teacherId: teacher.id.value };
  }
}
