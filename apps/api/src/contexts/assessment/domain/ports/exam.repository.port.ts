import type { Exam } from "../model/exam.aggregate.js";
import type { ExamId } from "../model/identifiers.js";

/** Persistencia del agregado `Exam` (una fila de `assessments`). */
export interface ExamRepository {
  save(exam: Exam): Promise<void>;
  findOrFail(id: ExamId): Promise<Exam>;
  findById(id: ExamId): Promise<Exam | null>;
}

export const EXAM_REPOSITORY = Symbol("ExamRepository");
