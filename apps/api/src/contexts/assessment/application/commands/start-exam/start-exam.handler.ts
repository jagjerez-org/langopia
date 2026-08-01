import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { ExamId } from "../../../domain/model/identifiers.js";
import { EXAM_REPOSITORY, type ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import { StartExamCommand } from "./start-exam.command.js";

/**
 * El alumno empieza el examen: arranca el cronómetro (`Exam.start()`), que
 * es la base del «aviso al alumno» del tiempo restante en la pantalla.
 */
@CommandHandler(StartExamCommand)
export class StartExamHandler implements ICommandHandler<StartExamCommand> {
  constructor(
    @Inject(EXAM_REPOSITORY) private readonly exams: ExamRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: StartExamCommand): Promise<{ examId: string; status: string; deadlineAt: string | null }> {
    const now = this.clock.now();
    const examId = ExamId.of(command.props.examId);

    const exam = await this.uow.execute(async () => {
      const found = await this.exams.findOrFail(examId);
      found.start({ now });
      await this.exams.save(found);
      return found;
    });

    await this.events.publish(exam.pullDomainEvents());
    return {
      examId: exam.id.value,
      status: exam.status,
      deadlineAt: exam.deadlineAt ? exam.deadlineAt.toISOString() : null,
    };
  }
}
