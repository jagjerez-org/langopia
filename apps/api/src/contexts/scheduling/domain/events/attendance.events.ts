import { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { AttendanceSource, AttendanceStatus } from "../model/attendance-status.js";

/**
 * Se registró la asistencia de un alumno a una clase.
 *
 * `sheetComplete` y `anyoneAttended` los calcula `AttendanceSheet` en el
 * mismo momento de marcar, porque es la única que tiene a la vista el resto
 * del grupo (`ARCHITECTURE.md`: un agregado no hace consultas, pero sí puede
 * razonar sobre los datos que ya trae cargados). El manejador que cierra la
 * clase (`OnAttendanceRecorded`) no vuelve a comprobar cobertura: confía en
 * este dato, igual que Facturación confía en el `refundDue` que calcula
 * `ClassSessionCanceled`.
 */
export class AttendanceRecorded extends DomainEvent {
  readonly eventName = "scheduling.attendance.recorded";

  constructor(
    private readonly data: {
      sessionId: string;
      schoolId: string;
      groupId: string;
      studentId: string;
      status: AttendanceStatus;
      source: AttendanceSource;
      /** Si con esta marca la hoja entera del grupo queda cubierta. */
      sheetComplete: boolean;
      /** Solo tiene sentido cuando `sheetComplete` es `true`. */
      anyoneAttended: boolean;
    },
  ) {
    super({ aggregateId: data.sessionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      sessionId: this.data.sessionId,
      groupId: this.data.groupId,
      studentId: this.data.studentId,
      status: this.data.status,
      source: this.data.source,
      sheetComplete: this.data.sheetComplete,
      anyoneAttended: this.data.anyoneAttended,
    };
  }
}
