import { Command } from "@nestjs/cqrs";

export class UpdateStudentCommand extends Command<{
  studentId: string;
  guardianRequired: boolean;
  currentLevel: string | null;
}> {
  constructor(
    readonly props: {
      studentId: string;
      /** Ausente: no se toca. Presente: se corrige a este valor. */
      dateOfBirth?: string;
      /** Ausente: no se toca. `null`: se borra el nivel. Presente: se fija. */
      currentLevel?: string | null;
    },
  ) {
    super();
  }
}
