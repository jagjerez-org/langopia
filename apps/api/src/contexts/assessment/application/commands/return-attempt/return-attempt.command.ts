import { Command } from "@nestjs/cqrs";

/**
 * El profesor devuelve el intento al alumno para que lo rehaga. No borra
 * nada: este intento queda en `returned`, y el siguiente empieza su propio
 * ciclo — el historial completo es dato pedagógico.
 */
export class ReturnAttemptCommand extends Command<{ attemptId: string; status: string }> {
  constructor(
    readonly props: {
      attemptId: string;
      teacherFeedback: string;
    },
  ) {
    super();
  }
}
