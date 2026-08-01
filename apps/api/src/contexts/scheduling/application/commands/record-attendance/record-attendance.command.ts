import { Command } from "@nestjs/cqrs";

/**
 * Pasar lista a mano.
 *
 * Cada entrada es un alumno de la clase; el origen que se guarda es siempre
 * «manual» (`AttendanceSheet.markPresent`/`markAbsent`), porque es
 * exactamente lo que este comando representa: el profesorado marcando desde
 * el panel, no el aula propia detectando ni un informe importado.
 */
export class RecordAttendanceCommand extends Command<{ sessionId: string; recorded: number }> {
  constructor(
    readonly props: {
      sessionId: string;
      entries: Array<{
        studentId: string;
        status: "present" | "absent";
        note?: string | null;
      }>;
    },
  ) {
    super();
  }
}
