import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { AttendanceRecorded } from "../events/attendance.events.js";
import {
  SessionNotStartedError,
  StudentNotEnrolledError,
} from "../errors/scheduling.errors.js";
import { AttendanceEntry } from "./attendance-entry.entity.js";
import { AttendanceSource, AttendanceStatus } from "./attendance-status.js";
import { AttendanceId, GroupId, SessionId, StudentId } from "./identifiers.js";

/**
 * Hoja de asistencia de una clase.
 *
 * Es su propio agregado, aparte de `ClassSession`, a propósito: una clase con
 * treinta alumnos no debe cargar treinta filas para cambiarle la hora, y la
 * asistencia se modifica mucho después de que la clase termine (un informe de
 * Zoom que llega al día siguiente). Su identidad ES la de la clase
 * (`SessionId`): no hay una fila «hoja» en la base de datos, solo las filas
 * de `attendance` que le pertenecen.
 *
 * El repositorio le entrega, además de las entradas ya guardadas, el
 * PADRÓN de alumnos matriculados en el grupo (`enrolledStudentIds`) — un dato
 * de `catalog` que llega ya resuelto por un adaptador de traducción, nunca
 * consultado por el propio agregado (`ARCHITECTURE.md`: un agregado no hace
 * consultas). Con ese padrón a la vista, la hoja sabe por sí misma cuándo está
 * completa, sin tener que volver a preguntar a nadie.
 */
export class AttendanceSheet extends AggregateRoot<SessionId> {
  private constructor(
    id: SessionId,
    private readonly _schoolId: SchoolId,
    private readonly _groupId: GroupId,
    private readonly _sessionStart: Date,
    private readonly _enrolledStudentIds: ReadonlySet<string>,
    private readonly _entries: Map<string, AttendanceEntry>,
  ) {
    super(id);
  }

  /**
   * Abre la hoja para operar sobre ella.
   *
   * No es una «creación» en el sentido de `ClassSession.schedule()`: no hay
   * ningún hecho de negocio en abrir una hoja, así que no emite evento. Sirve
   * igual para la primera vez que se pasa lista (`existingEntries` vacío) que
   * para una corrección posterior (`existingEntries` con lo ya guardado).
   */
  static open(params: {
    sessionId: SessionId;
    schoolId: SchoolId;
    groupId: GroupId;
    sessionStart: Date;
    enrolledStudentIds: StudentId[];
    existingEntries?: AttendanceEntry[];
  }): AttendanceSheet {
    const entries = new Map<string, AttendanceEntry>();
    for (const entry of params.existingEntries ?? []) {
      entries.set(entry.studentId.value, entry);
    }
    return new AttendanceSheet(
      params.sessionId,
      params.schoolId,
      params.groupId,
      params.sessionStart,
      new Set(params.enrolledStudentIds.map((s) => s.value)),
      entries,
    );
  }

  /**
   * Marca a un alumno presente.
   *
   * El origen siempre es «manual»: quien llama a este método es el
   * profesorado pasando lista a mano desde el panel. Lo detectado por el aula
   * propia o lo importado de un informe externo llegan por otro camino
   * (`importFrom`), con su propio origen.
   */
  markPresent(params: {
    entryId: AttendanceId;
    studentId: StudentId;
    now: Date;
    recordedBy?: MembershipId | null;
    joinedAt?: Date | null;
    leftAt?: Date | null;
    minutesPresent?: number | null;
    note?: string | null;
  }): void {
    this.upsert({
      entryId: params.entryId,
      studentId: params.studentId,
      status: AttendanceStatus.Present,
      source: AttendanceSource.Manual,
      now: params.now,
      recordedBy: params.recordedBy ?? null,
      joinedAt: params.joinedAt ?? null,
      leftAt: params.leftAt ?? null,
      minutesPresent: params.minutesPresent ?? null,
      note: params.note ?? null,
    });
  }

  /** Marca a un alumno ausente. Mismo origen «manual» que `markPresent`. */
  markAbsent(params: {
    entryId: AttendanceId;
    studentId: StudentId;
    now: Date;
    recordedBy?: MembershipId | null;
    note?: string | null;
  }): void {
    this.upsert({
      entryId: params.entryId,
      studentId: params.studentId,
      status: AttendanceStatus.Absent,
      source: AttendanceSource.Manual,
      now: params.now,
      recordedBy: params.recordedBy ?? null,
      joinedAt: null,
      leftAt: null,
      minutesPresent: 0,
      note: params.note ?? null,
    });
  }

  /**
   * Importa un lote del informe de asistencia del proveedor de vídeo (Zoom,
   * Meet, Teams). El origen siempre es «importado»: da igual lo que sepa el
   * informe sobre cada alumno, la procedencia del dato es la misma para todo
   * el lote.
   */
  importFrom(
    entries: Array<{
      entryId: AttendanceId;
      studentId: StudentId;
      status: AttendanceStatus;
      joinedAt?: Date | null;
      leftAt?: Date | null;
      minutesPresent?: number | null;
    }>,
    params: { now: Date },
  ): void {
    for (const entry of entries) {
      this.upsert({
        entryId: entry.entryId,
        studentId: entry.studentId,
        status: entry.status,
        source: AttendanceSource.Imported,
        now: params.now,
        recordedBy: null,
        joinedAt: entry.joinedAt ?? null,
        leftAt: entry.leftAt ?? null,
        minutesPresent: entry.minutesPresent ?? null,
        note: null,
      });
    }
  }

  private upsert(params: {
    entryId: AttendanceId;
    studentId: StudentId;
    status: AttendanceStatus;
    source: AttendanceSource;
    now: Date;
    recordedBy: MembershipId | null;
    joinedAt: Date | null;
    leftAt: Date | null;
    minutesPresent: number | null;
    note: string | null;
  }): void {
    this.assertStarted(params.now);
    this.assertEnrolled(params.studentId);

    const entry = AttendanceEntry.create({
      id: params.entryId,
      sessionId: this.id,
      studentId: params.studentId,
      status: params.status,
      source: params.source,
      joinedAt: params.joinedAt,
      leftAt: params.leftAt,
      minutesPresent: params.minutesPresent,
      note: params.note,
      recordedByMembershipId: params.recordedBy,
      now: params.now,
    });
    this._entries.set(params.studentId.value, entry);

    this.record(
      new AttendanceRecorded({
        sessionId: this.id.value,
        schoolId: this._schoolId.value,
        groupId: this._groupId.value,
        studentId: params.studentId.value,
        status: params.status,
        source: params.source,
        sheetComplete: this.isFullyCovered,
        anyoneAttended: this.anyoneAttended,
      }),
    );
  }

  private assertStarted(now: Date): void {
    if (now < this._sessionStart) {
      throw new SessionNotStartedError(this.id.value, this._sessionStart, now);
    }
  }

  private assertEnrolled(studentId: StudentId): void {
    if (!this._enrolledStudentIds.has(studentId.value)) {
      throw new StudentNotEnrolledError(studentId.value, this._groupId.value);
    }
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get groupId(): GroupId {
    return this._groupId;
  }
  get entries(): readonly AttendanceEntry[] {
    return [...this._entries.values()];
  }

  /** Todo el alumnado matriculado tiene ya una entrada, sea cual sea su estado. */
  get isFullyCovered(): boolean {
    if (this._enrolledStudentIds.size === 0) return false;
    for (const studentId of this._enrolledStudentIds) {
      if (!this._entries.has(studentId)) return false;
    }
    return true;
  }

  /** Si al menos un alumno cuenta como asistido (`present` o `late`). */
  get anyoneAttended(): boolean {
    for (const entry of this._entries.values()) {
      if (entry.counts) return true;
    }
    return false;
  }
}
