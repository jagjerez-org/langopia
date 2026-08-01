import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MissingExamActorError } from "../../../domain/errors/assessment.errors.js";
import { ExamId } from "../../../domain/model/identifiers.js";
import { EXAM_REPOSITORY, type ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import { ValidateExamCommand } from "./validate-exam.command.js";

/**
 * El profesor firma. Sin reglas propias: resuelve quién firma (la
 * membresía autenticada, nunca un campo del comando) y le pide a
 * `Exam.validate()` que haga el resto — incluida la propuesta de subir de
 * nivel si corresponde, que viaja en los eventos, no en esta respuesta.
 */
@CommandHandler(ValidateExamCommand)
export class ValidateExamHandler implements ICommandHandler<ValidateExamCommand> {
  constructor(
    @Inject(EXAM_REPOSITORY) private readonly exams: ExamRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ValidateExamCommand): Promise<{ examId: string; status: string; countsForRecord: boolean }> {
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingExamActorError();
    const now = this.clock.now();
    const examId = ExamId.of(command.props.examId);

    const exam = await this.uow.execute(async () => {
      const found = await this.exams.findOrFail(examId);
      found.validate({ score: command.props.score, membershipId: actor, now });
      await this.exams.save(found);
      return found;
    });

    await this.events.publish(exam.pullDomainEvents());
    return { examId: exam.id.value, status: exam.status, countsForRecord: exam.countsForRecord };
  }
}
