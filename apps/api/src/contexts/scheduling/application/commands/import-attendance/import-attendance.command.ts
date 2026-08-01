import { Command } from "@nestjs/cqrs";
import type { AttendanceStatus } from "../../../domain/model/attendance-status.js";

/**
 * Importar el informe de asistencia del proveedor de vídeo (Zoom, Meet,
 * Teams). Llega después de que la clase termine, no antes: por eso es un
 * comando aparte de `RecordAttendanceCommand` y no una variante suya. El
 * origen que se guarda es siempre «importado» (`AttendanceSheet.importFrom`).
 */
export class ImportAttendanceCommand extends Command<{ sessionId: string; imported: number }> {
  constructor(
    readonly props: {
      sessionId: string;
      entries: Array<{
        studentId: string;
        status: AttendanceStatus;
        joinedAt?: string | null;
        leftAt?: string | null;
        minutesPresent?: number | null;
      }>;
    },
  ) {
    super();
  }
}
