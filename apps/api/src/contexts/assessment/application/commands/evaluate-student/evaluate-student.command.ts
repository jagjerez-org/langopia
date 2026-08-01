import { Command } from "@nestjs/cqrs";

/**
 * El profesor valora a un alumno tras una clase.
 *
 * `teacherId` viaja explícito en el comando, igual que `teacherId` en
 * `ScheduleClassSessionCommand`: quien lo ejecuta no tiene por qué ser el
 * propio profesor (dirección puede registrar en su nombre). La invariante que
 * de verdad protege «solo valora quien dio la clase» no es de quién viene la
 * petición, sino el hecho de negocio que comprueba `TeachesStudentPort`.
 */
export class EvaluateStudentCommand extends Command<{ evaluationId: string }> {
  constructor(
    readonly props: {
      teacherId: string;
      studentId: string;
      periodStart: string;
      periodEnd: string;
      progressRating: number;
      levelAtEvaluation?: string | null;
      strengths?: string | null;
      improvements?: string | null;
      nextSteps?: string | null;
    },
  ) {
    super();
  }
}
