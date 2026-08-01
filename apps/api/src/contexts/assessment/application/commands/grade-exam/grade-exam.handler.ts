import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { scoreAutomatically } from "../../../domain/model/automatic-grading.js";
import type { Exam, ExamItem, ExamItemResult } from "../../../domain/model/exam.aggregate.js";
import { ExamId } from "../../../domain/model/identifiers.js";
import { Rubric } from "../../../domain/model/rubric.vo.js";
import { EXAM_REPOSITORY, type ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import {
  EXERCISE_SOURCE_PORT,
  type ExerciseSourcePort,
} from "../../../domain/ports/exercise-source.port.js";
import {
  WRITING_CORRECTOR_PORT,
  type WritingCorrectorPort,
} from "../../../domain/ports/writing-corrector.port.js";
import { GradeExamCommand } from "./grade-exam.command.js";

/**
 * Manejador del comando.
 *
 * Reutiliza EXACTAMENTE la misma corrección que un intento suelto
 * (`submit-attempt.handler.ts`, tarea 7): `scoreAutomatically` para los
 * ítems con `solution`, `WritingCorrectorPort` + `Rubric.weightedScore`
 * para los de rúbrica con texto de respuesta. `Exam.grade()` es quien
 * agrega esas notas en la nota final y el desglose por destreza — este
 * manejador solo calcula CADA nota, no la aritmética del examen completo.
 *
 * Si un ítem de rúbrica no tiene con qué corregirse (sin texto, sin
 * `ANTHROPIC_API_KEY`, o cualquier fallo del corrector), simplemente no
 * entra en `itemResults`: `Exam.grade()` no exige que TODOS los ítems
 * tengan resultado, y el profesor puede firmar igual —«la IA propone; si no
 * puede proponer nada, el profesor firma»—, mismo criterio que
 * `SubmitAttemptHandler.grade()`.
 */
@CommandHandler(GradeExamCommand)
export class GradeExamHandler implements ICommandHandler<GradeExamCommand> {
  constructor(
    @Inject(EXAM_REPOSITORY) private readonly exams: ExamRepository,
    @Inject(EXERCISE_SOURCE_PORT) private readonly exerciseSource: ExerciseSourcePort,
    @Inject(WRITING_CORRECTOR_PORT) private readonly corrector: WritingCorrectorPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(GradeExamHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: GradeExamCommand): Promise<{ examId: string; status: string; score: number | null }> {
    const now = this.clock.now();
    const examId = ExamId.of(command.props.examId);

    const exam = await this.uow.read(() => this.exams.findOrFail(examId));
    const itemResults = await this.gradeAllItems(exam);

    const graded = await this.uow.execute(async () => {
      const found = await this.exams.findOrFail(examId);
      found.grade({ itemResults, now });
      await this.exams.save(found);
      return found;
    });

    await this.events.publish(graded.pullDomainEvents());
    return { examId: graded.id.value, status: graded.status, score: graded.score };
  }

  private async gradeAllItems(exam: Exam): Promise<Record<string, ExamItemResult>> {
    const results: Record<string, ExamItemResult> = {};

    for (const section of exam.sections) {
      for (const item of section.items) {
        if (!item.response) continue;

        const result = item.rubricId
          ? await this.gradeByRubric(item, exam.language, exam.level)
          : item.solution
            ? this.gradeAutomatically(item)
            : null;

        if (result) results[item.id] = result;
      }
    }
    return results;
  }

  /** `written_production`/`spoken_production`: solo si hay texto que corregir. */
  private async gradeByRubric(item: ExamItem, language: string, level: string): Promise<ExamItemResult | null> {
    const responseText = item.response?.["text"];
    if (typeof responseText !== "string" || responseText.length === 0) return null;
    if (!item.rubricCode) return null;

    try {
      const rubricInfo = await this.uow.read(() => this.exerciseSource.getRubricByCode(item.rubricCode!));
      if (!rubricInfo) return null;

      const rubric = Rubric.reconstitute({
        id: item.rubricId!,
        code: item.rubricCode,
        maxScore: item.maxScore,
        criteria: rubricInfo.criteria,
      });

      const task = typeof item.prompt["task"] === "string" ? (item.prompt["task"] as string) : "";
      const result = await this.corrector.correct({
        task,
        response: responseText,
        rubric: { criteria: rubric.criteria },
        language,
        level,
      });

      return {
        score: rubric.weightedScore(result.byCriterion),
        feedback: result.feedback,
        model: result.cost.model,
        costCents: result.cost.costCents,
      };
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo corregir con IA el ítem ${item.id} del examen: queda pendiente de validación directa del profesor.`,
      );
      return null;
    }
  }

  private gradeAutomatically(item: ExamItem): ExamItemResult {
    const result = scoreAutomatically(item.response!, item.solution!, item.maxScore);
    return { score: result.score, feedback: result.feedback, model: null, costCents: 0 };
  }
}
