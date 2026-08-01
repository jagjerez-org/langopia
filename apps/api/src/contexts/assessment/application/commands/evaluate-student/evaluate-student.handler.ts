import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import {
  EvaluationPeriodOverlapError,
  TeacherDoesNotTeachStudentError,
} from "../../../domain/errors/assessment.errors.js";
import { Evaluation } from "../../../domain/model/evaluation.aggregate.js";
import { EvaluationId, StudentId, TeacherId } from "../../../domain/model/identifiers.js";
import {
  EVALUATION_REPOSITORY,
  type EvaluationRepository,
} from "../../../domain/ports/evaluation.repository.port.js";
import {
  STUDENT_MINOR_PORT,
  type StudentMinorPort,
} from "../../../domain/ports/student-minor.port.js";
import {
  TEACHES_STUDENT_PORT,
  type TeachesStudentPort,
} from "../../../domain/ports/teaches-student.port.js";
import { EvaluateStudentCommand } from "./evaluate-student.command.js";

/** Columna `date` de Postgres a medianoche UTC, igual que `DateOfBirth`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

/**
 * Manejador del comando.
 *
 * Coreografía, no reglas: comprueba el hecho de negocio que el agregado no
 * puede comprobar por sí mismo —¿de verdad este profesor dio clase a este
 * alumno en este periodo? (`TeachesStudentPort`, hacia `scheduling`)—, reúne
 * las valoraciones previas para que el agregado detecte el solape
 * (`overlapsWith`), pregunta si el alumno es menor (`StudentMinorPort`, hacia
 * `people`) y le pide a `Evaluation.write()` que haga el resto.
 */
@CommandHandler(EvaluateStudentCommand)
export class EvaluateStudentHandler implements ICommandHandler<EvaluateStudentCommand> {
  constructor(
    @Inject(EVALUATION_REPOSITORY) private readonly evaluations: EvaluationRepository,
    @Inject(TEACHES_STUDENT_PORT) private readonly teaches: TeachesStudentPort,
    @Inject(STUDENT_MINOR_PORT) private readonly minors: StudentMinorPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: EvaluateStudentCommand): Promise<{ evaluationId: string }> {
    const { props } = command;
    const now = this.clock.now();
    const teacherId = TeacherId.of(props.teacherId);
    const studentId = StudentId.of(props.studentId);
    const periodStart = dateOnlyToUtc(props.periodStart);
    const periodEnd = dateOnlyToUtc(props.periodEnd);

    const evaluation = await this.uow.execute(async () => {
      const taught = await this.teaches.taught({ teacherId, studentId, periodStart, periodEnd });
      if (!taught) {
        throw new TeacherDoesNotTeachStudentError(teacherId.value, studentId.value);
      }

      const existing = await this.evaluations.findByTeacherAndStudent({ teacherId, studentId });
      const conflicting = existing.find((e) => e.overlapsWith({ periodStart, periodEnd }));
      if (conflicting) {
        throw new EvaluationPeriodOverlapError(teacherId.value, studentId.value, conflicting.id.value);
      }

      const studentIsMinor = await this.minors.isMinor(studentId);

      const created = Evaluation.write({
        id: EvaluationId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        teacherProfileId: teacherId.value,
        studentProfileId: studentId.value,
        periodStart,
        periodEnd,
        progressRating: props.progressRating,
        levelAtEvaluation: (props.levelAtEvaluation ?? null) as CefrLevel | null,
        strengths: props.strengths ?? null,
        improvements: props.improvements ?? null,
        nextSteps: props.nextSteps ?? null,
        studentIsMinor,
        now,
      });

      await this.evaluations.save(created);
      return created;
    });

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería haberse enterado de una valoración que no existe.
    await this.events.publish(evaluation.pullDomainEvents());

    return { evaluationId: evaluation.id.value };
  }
}
