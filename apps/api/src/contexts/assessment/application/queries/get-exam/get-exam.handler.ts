import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { ExamId } from "../../../domain/model/identifiers.js";
import { EXAM_REPOSITORY, type ExamRepository } from "../../../domain/ports/exam.repository.port.js";

export interface ExamItemPublicView {
  id: string;
  type: string;
  skill: string;
  prompt: Record<string, unknown>;
  response: Record<string, unknown> | null;
  /** Nunca `solution`: eso no llega al alumnado (regla de la ola, ni siquiera de lectura). */
  result: { score: number; feedback: string } | null;
  maxScore: number;
}

export interface ExamSectionPublicView {
  skill: string;
  durationMinutes: number;
  items: ExamItemPublicView[];
}

export interface ExamPublicView {
  examId: string;
  kind: string;
  title: string;
  status: string;
  scheduledFor: string | null;
  startedAt: string | null;
  deadlineAt: string | null;
  durationMinutes: number;
  score: number | null;
  aiScore: number | null;
  aiFeedback: string | null;
  skillBreakdown: Readonly<Record<string, number>>;
  countsForRecord: boolean;
  sections: ExamSectionPublicView[];
}

export class GetExamQuery extends Query<ExamPublicView> {
  constructor(readonly props: { examId: string }) {
    super();
  }
}

/**
 * Consulta directa al agregado, sin modelo de lectura aparte: a diferencia
 * de otras consultas de este contexto, la forma que necesita la pantalla
 * (secciones con sus ítems) ES la forma del agregado — todo el examen vive
 * en una única columna JSON de `assessments` (`ExamMapper`), así que
 * proyectar un modelo de lectura distinto solo duplicaría la misma
 * estructura sin ganar nada. Nunca expone `solution`, `rubricId` ni el
 * coste/modelo de la corrección: eso no es del alumnado.
 */
@QueryHandler(GetExamQuery)
export class GetExamHandler implements IQueryHandler<GetExamQuery> {
  constructor(
    @Inject(EXAM_REPOSITORY) private readonly exams: ExamRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(query: GetExamQuery): Promise<ExamPublicView> {
    const exam = await this.uow.read(() => this.exams.findOrFail(ExamId.of(query.props.examId)));

    return {
      examId: exam.id.value,
      kind: exam.kind,
      title: exam.title,
      status: exam.status,
      scheduledFor: exam.scheduledFor ? exam.scheduledFor.toISOString() : null,
      startedAt: exam.startedAt ? exam.startedAt.toISOString() : null,
      deadlineAt: exam.deadlineAt ? exam.deadlineAt.toISOString() : null,
      durationMinutes: exam.durationMinutes,
      score: exam.score,
      aiScore: exam.aiScore,
      aiFeedback: exam.aiFeedback,
      skillBreakdown: exam.skillBreakdown,
      countsForRecord: exam.countsForRecord,
      sections: exam.sections.map((section) => ({
        skill: section.skill,
        durationMinutes: section.durationMinutes,
        items: section.items.map((item) => ({
          id: item.id,
          type: item.type,
          skill: item.skill,
          prompt: item.prompt,
          response: item.response,
          result: item.result ? { score: item.result.score, feedback: item.result.feedback } : null,
          maxScore: item.maxScore,
        })),
      })),
    };
  }
}
