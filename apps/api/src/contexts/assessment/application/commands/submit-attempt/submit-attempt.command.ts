import { Command } from "@nestjs/cqrs";

/** Lo que ve quien acaba de enviar una respuesta: si la corrección ya llegó, y qué dice. */
export type SubmitAttemptResult = {
  attemptId: string;
  status: string;
  /** `null`: todavía no hay corrección automática (rúbrica sin texto, o falló). */
  aiScore: number | null;
  aiFeedback: string | null;
  maxScore: number;
  /** Si el ejercicio exige rúbrica (nunca cuenta hasta que el profesor firme, aunque haya `aiScore`). */
  requiresTeacherValidation: boolean;
};

/**
 * Un alumno envía su respuesta a un ejercicio.
 *
 * `studentProfileId` viaja explícito, igual que `teacherId` en
 * `EvaluateStudentCommand`: quien lo ejecuta no tiene por qué ser el propio
 * alumno (un profesor puede digitalizar un intento en papel durante la
 * clase). El portal del alumno (autoservicio, tarea 12 de la ola 2) llama a
 * este MISMO comando resolviendo su propio `studentProfileId` de la sesión
 * (`GET /portal/me/students`, ya construido) — `SubmitAttemptHandler`
 * comprueba que coincide con quien lo llama cuando no es dirección ni
 * profesorado.
 */
export class SubmitAttemptCommand extends Command<SubmitAttemptResult> {
  constructor(
    readonly props: {
      exerciseId: string;
      studentProfileId: string;
      response: Record<string, unknown>;
      sessionId?: string | null;
      assessmentId?: string | null;
      startedAt?: string | null;
      durationMs?: number | null;
    },
  ) {
    super();
  }
}
