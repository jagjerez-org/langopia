import { api } from "../../lib/api-client.js";
import type {
  ExamDetail,
  GenerateExamInput,
  GenerateExamResult,
  GradeExamResult,
  StartExamResult,
  SubmitExamResult,
  ValidateExamResult,
} from "./types.js";

/**
 * Cliente HTTP de la Tarea 15 de la ola 2 (generación y corrección de
 * exámenes), sobre el cliente compartido (`apps/app/src/lib/api-client.ts`).
 */

export function generateExam(input: GenerateExamInput): Promise<GenerateExamResult> {
  return api.post<GenerateExamResult>("/assessments/exams", input);
}

export function getExam(examId: string): Promise<ExamDetail> {
  return api.get<ExamDetail>(`/assessments/exams/${examId}`);
}

export function startExam(examId: string): Promise<StartExamResult> {
  return api.post<StartExamResult>(`/assessments/exams/${examId}/start`);
}

export function submitExam(
  examId: string,
  responses: Record<string, Record<string, unknown>>,
): Promise<SubmitExamResult> {
  return api.post<SubmitExamResult>(`/assessments/exams/${examId}/submit`, { responses });
}

export function gradeExam(examId: string): Promise<GradeExamResult> {
  return api.post<GradeExamResult>(`/assessments/exams/${examId}/grade`);
}

export function validateExam(examId: string, score: number): Promise<ValidateExamResult> {
  return api.post<ValidateExamResult>(`/assessments/exams/${examId}/validate`, { score });
}
