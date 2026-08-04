export type ExamKind = "unit_exam" | "level_exam" | "mock_official";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface GenerateExamInput {
  kind: ExamKind;
  studentProfileIds: string[];
  title: string;
  language: string;
  level: CefrLevel;
  sourceContentUnitIds: string[];
  durationMinutes: number;
  mockFramework?: string | null;
}

export interface GenerateExamResult {
  examIds: string[];
  status: string;
}

/** Un ítem del examen tal como lo devuelve la API (sin `solution`: eso no llega al alumnado). */
export interface ExamItemView {
  id: string;
  type: string;
  skill: string;
  prompt: Record<string, unknown>;
  response: Record<string, unknown> | null;
  result: { score: number; feedback: string } | null;
  maxScore: number;
}

export interface ExamSectionView {
  skill: string;
  durationMinutes: number;
  items: ExamItemView[];
}

export interface StartExamResult {
  examId: string;
  status: string;
  deadlineAt: string | null;
}

export interface SubmitExamResult {
  examId: string;
  status: string;
}

export interface GradeExamResult {
  examId: string;
  status: string;
  score: number | null;
}

export interface ValidateExamResult {
  examId: string;
  status: string;
  countsForRecord: boolean;
}

/** Forma de `GET /assessments/exams/:id` (`GetExamHandler`). */
export interface ExamDetail {
  examId: string;
  kind: ExamKind;
  title: string;
  status: string;
  scheduledFor: string | null;
  startedAt: string | null;
  deadlineAt: string | null;
  durationMinutes: number;
  score: number | null;
  aiScore: number | null;
  aiFeedback: string | null;
  skillBreakdown: Record<string, number>;
  countsForRecord: boolean;
  sections: ExamSectionView[];
}
