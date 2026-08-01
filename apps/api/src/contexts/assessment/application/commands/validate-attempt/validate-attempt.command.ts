import { Command } from "@nestjs/cqrs";

/**
 * El profesor firma la nota de un intento. Es la única acción que hace que
 * la nota cuente para el expediente (regla de la ola: «la IA propone, el
 * profesor firma»).
 *
 * `teacherScore` puede subir o bajar la propuesta de la IA sin restricción:
 * quién lo hizo y cuándo lo resuelve el propio manejador a partir de la
 * membresía autenticada, nunca un campo del comando — así no se puede firmar
 * en nombre de otro.
 */
export class ValidateAttemptCommand extends Command<{ attemptId: string; status: string }> {
  constructor(
    readonly props: {
      attemptId: string;
      teacherScore: number;
      teacherFeedback?: string | null;
    },
  ) {
    super();
  }
}
