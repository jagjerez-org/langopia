import { Entity } from "../../../shared/domain/primitives/entity.js";
import { MembershipId } from "../../../shared/domain/primitives/school-id.js";
import type { AttendanceSource, AttendanceStatus } from "./attendance-status.js";
import type { AttendanceId, SessionId, StudentId } from "./identifiers.js";

/**
 * Una fila de asistencia: un alumno, una clase, un estado.
 *
 * Entidad interna del agregado `AttendanceSheet`, no una raíz propia: su
 * invariante —quién puede marcarse y cuándo— solo se puede comprobar con la
 * hoja entera a la vista (el resto del grupo, si ya está cubierta), igual que
 * `Enrollment` vive dentro de `Group` en `catalog`.
 */
export class AttendanceEntry extends Entity<AttendanceId> {
  private constructor(
    id: AttendanceId,
    private readonly _sessionId: SessionId,
    private readonly _studentId: StudentId,
    private _status: AttendanceStatus,
    private readonly _source: AttendanceSource,
    private readonly _joinedAt: Date | null,
    private readonly _leftAt: Date | null,
    private readonly _minutesPresent: number | null,
    private readonly _note: string | null,
    private readonly _recordedByMembershipId: MembershipId | null,
    private readonly _createdAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: AttendanceId;
    sessionId: SessionId;
    studentId: StudentId;
    status: AttendanceStatus;
    source: AttendanceSource;
    joinedAt: Date | null;
    leftAt: Date | null;
    minutesPresent: number | null;
    note: string | null;
    recordedByMembershipId: MembershipId | null;
    now: Date;
  }): AttendanceEntry {
    return new AttendanceEntry(
      props.id,
      props.sessionId,
      props.studentId,
      props.status,
      props.source,
      props.joinedAt,
      props.leftAt,
      props.minutesPresent,
      props.note,
      props.recordedByMembershipId,
      props.now,
    );
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: AttendanceId;
    sessionId: SessionId;
    studentId: StudentId;
    status: AttendanceStatus;
    source: AttendanceSource;
    joinedAt: Date | null;
    leftAt: Date | null;
    minutesPresent: number | null;
    note: string | null;
    recordedByMembershipId: MembershipId | null;
    createdAt: Date;
  }): AttendanceEntry {
    return new AttendanceEntry(
      props.id,
      props.sessionId,
      props.studentId,
      props.status,
      props.source,
      props.joinedAt,
      props.leftAt,
      props.minutesPresent,
      props.note,
      props.recordedByMembershipId,
      props.createdAt,
    );
  }

  get sessionId(): SessionId {
    return this._sessionId;
  }
  get studentId(): StudentId {
    return this._studentId;
  }
  get status(): AttendanceStatus {
    return this._status;
  }
  get source(): AttendanceSource {
    return this._source;
  }
  get joinedAt(): Date | null {
    return this._joinedAt;
  }
  get leftAt(): Date | null {
    return this._leftAt;
  }
  get minutesPresent(): number | null {
    return this._minutesPresent;
  }
  get note(): string | null {
    return this._note;
  }
  get recordedByMembershipId(): MembershipId | null {
    return this._recordedByMembershipId;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  /** Cuenta como asistido para decidir si la clase se cierra `completed` o `no_show`. */
  get counts(): boolean {
    return this._status === "present" || this._status === "late";
  }
}
