import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "../../../domain/model/date-of-birth.vo.js";
import { GuardianId, StudentId } from "../../../domain/model/identifiers.js";
import { Student } from "../../../domain/model/student.aggregate.js";
import { GuardianRequiredError } from "../../../domain/errors/people.errors.js";
import {
  MEMBERSHIP_PROVISIONING_PORT,
  type MembershipProvisioningPort,
} from "../../../domain/ports/membership-provisioning.port.js";
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from "../../../domain/ports/student.repository.port.js";
import { EnrolStudentCommand } from "./enrol-student.command.js";

/**
 * Alta de un alumno.
 *
 * `people` no crea usuarios ni membresías por su cuenta: se las pide a `iam`
 * a través de `MembershipProvisioningPort`, la capa anticorrupción. El
 * aprovisionamiento ocurre DENTRO de la misma transacción que el alta del
 * agregado, para que ninguno de los dos quede a medias si el otro falla.
 */
@CommandHandler(EnrolStudentCommand)
export class EnrolStudentHandler implements ICommandHandler<EnrolStudentCommand> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(MEMBERSHIP_PROVISIONING_PORT) private readonly members: MembershipProvisioningPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: EnrolStudentCommand) {
    const { props } = command;
    const now = this.clock.now();
    const dateOfBirth = DateOfBirth.of(props.dateOfBirth);
    const esMenor = dateOfBirth.isMinorAt(now);

    if (esMenor && !props.guardian) throw new GuardianRequiredError();

    const student = await this.uow.execute(async () => {
      const membershipId = await this.members.provisionStudent({
        name: props.name,
        email: props.email,
        locale: props.locale ?? null,
      });

      const creado = Student.enrol({
        id: StudentId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        membershipId: MembershipId.of(membershipId),
        dateOfBirth,
        nativeLanguage: props.nativeLanguage,
        targetLanguage: props.targetLanguage,
        now,
      });

      // Bug heredado (Tarea 14, cerrado en la Tarea 15): `Student.enrol()` no
      // acepta `currentLevel` — el agregado solo lo ajusta a través de
      // `changeLevel()`, y este manejador nunca lo llamaba. El nivel MCER que
      // llegaba en la petición (`POST /students`, y la importación CSV que
      // reutiliza este mismo comando) se leía, se validaba en el DTO... y se
      // tiraba. La vía de edición (`UpdateStudentHandler`) sí lo aplicaba, así
      // que el defecto solo afectaba al alta.
      if (props.currentLevel) {
        creado.changeLevel(props.currentLevel as CefrLevel);
      }

      if (props.guardian) {
        const guardianMembershipId = await this.members.provisionGuardian({
          name: props.guardian.name,
          email: props.guardian.email,
          locale: props.locale ?? null,
        });
        creado.addGuardian({
          id: GuardianId.of(this.ids.generate()),
          membershipId: MembershipId.of(guardianMembershipId),
          relationship: props.guardian.relationship,
          canGiveConsent: true,
        });
      }

      await this.students.save(creado);
      return creado;
    });

    await this.events.publish(student.pullDomainEvents());
    return {
      studentId: student.id.value,
      guardianRequired: student.guardianRequired,
      currentLevel: student.currentLevel,
    };
  }
}
