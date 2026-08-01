import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  ClassSessionCanceled,
  ClassSessionCompleted,
  ClassSessionRescheduled,
  ClassSessionScheduled,
} from "../events/class-session.events.js";
import {
  CannotScheduleInThePastError,
  SessionAlreadyClosedError,
} from "../errors/scheduling.errors.js";
import { Cancellation, type CancellingParty } from "./cancellation.vo.js";
import type { CancellationPolicy } from "./cancellation-policy.js";
import { GroupId, SessionId, TeacherId } from "./identifiers.js";
import type { Room } from "./room.vo.js";
import { CancelingParty, SessionStatus } from "./session-status.js";
import type { TimeSlot } from "./time-slot.vo.js";

export type { SessionStatus } from "./session-status.js";

/** Estados desde los que ya no se puede hacer nada: la clase está cerrada. */
const CLOSED_STATUSES: readonly SessionStatus[] = [
  SessionStatus.Completed,
  SessionStatus.CanceledBySchool,
  SessionStatus.CanceledByStudent,
  SessionStatus.Rescheduled,
  SessionStatus.NoShow,
];

/**
 * Clase.
 *
 * Es la raíz del agregado de programación: todo lo que se hace con una clase
 * pasa por aquí, y aquí es donde viven sus invariantes.
 *
 * Lo que NO está en este agregado, y por qué:
 *
 *   · La ASISTENCIA es su propio agregado. Una clase con treinta alumnos no
 *     debe cargar treinta filas para cambiarle la hora, y la asistencia se
 *     modifica mucho después de que la clase termine.
 *
 *   · La MATRÍCULA vive en otro contexto. Aquí solo se conoce el grupo.
 *
 *   · La DISPONIBILIDAD del profesor se consulta a través de un puerto: es
 *     información de otro contexto y este no puede decidir sobre ella.
 */
export class ClassSession extends AggregateRoot<SessionId> {
  private constructor(
    id: SessionId,
    private readonly _schoolId: SchoolId,
    private readonly _groupId: GroupId,
    private _teacherId: TeacherId | null,
    private _slot: TimeSlot,
    private _room: Room,
    private _status: SessionStatus,
    private _topic: string | null,
    private _contentUnitId: string | null,
    private _cancellation: Cancellation | null,
    private _rescheduledFrom: SessionId | null,
    private _actualStart: Date | null,
    private _actualEnd: Date | null,
  ) {
    super(id);
  }

  /* ─── Creación ─────────────────────────────────────────────────────── */

  /**
   * Programa una clase nueva.
   *
   * No comprueba solapes ni disponibilidad del profesor: eso necesita
   * consultar otras clases y otro contexto, y un agregado no puede hacer
   * consultas. Lo hace el manejador del comando antes de llamar aquí, que es
   * quien sí tiene los puertos.
   */
  static schedule(params: {
    id: SessionId;
    schoolId: SchoolId;
    groupId: GroupId;
    teacherId: TeacherId | null;
    slot: TimeSlot;
    room: Room;
    topic?: string | null;
    contentUnitId?: string | null;
    now: Date;
  }): ClassSession {
    if (!params.slot.startsAfter(params.now)) {
      throw new CannotScheduleInThePastError(params.slot.start, params.now);
    }

    const session = new ClassSession(
      params.id,
      params.schoolId,
      params.groupId,
      params.teacherId,
      params.slot,
      params.room,
      SessionStatus.Scheduled,
      params.topic ?? null,
      params.contentUnitId ?? null,
      null,
      null,
      null,
      null,
    );

    session.record(
      new ClassSessionScheduled({
        sessionId: params.id.value,
        schoolId: params.schoolId.value,
        groupId: params.groupId.value,
        teacherId: params.teacherId?.value ?? null,
        start: params.slot.start,
        end: params.slot.end,
        roomProvider: params.room.provider,
      }),
    );
    return session;
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: SessionId;
    schoolId: SchoolId;
    groupId: GroupId;
    teacherId: TeacherId | null;
    slot: TimeSlot;
    room: Room;
    status: SessionStatus;
    topic: string | null;
    contentUnitId: string | null;
    cancellation: Cancellation | null;
    rescheduledFrom: SessionId | null;
    actualStart: Date | null;
    actualEnd: Date | null;
  }): ClassSession {
    return new ClassSession(
      props.id,
      props.schoolId,
      props.groupId,
      props.teacherId,
      props.slot,
      props.room,
      props.status,
      props.topic,
      props.contentUnitId,
      props.cancellation,
      props.rescheduledFrom,
      props.actualStart,
      props.actualEnd,
    );
  }

  /* ─── Comportamiento ───────────────────────────────────────────────── */

  /**
   * Cancela la clase.
   *
   * Quien llama no decide si hay devolución: lo decide la política de la
   * escuela, y queda congelado en la cancelación. Facturación se entera por
   * el evento y abre la devolución si procede.
   */
  cancel(params: {
    party: CancellingParty;
    by: MembershipId;
    reason: string;
    policy: CancellationPolicy;
    now: Date;
  }): void {
    this.assertOpen("cancelar");

    const noticeHours = this._slot.hoursOfNoticeFrom(params.now);
    const refundDue = params.policy.refundDueFor({
      party: params.party,
      slot: this._slot,
      canceledAt: params.now,
    });

    this._cancellation = Cancellation.of({
      at: params.now,
      by: params.by,
      party: params.party,
      reason: params.reason,
      noticeHours,
      refundDue,
    });
    this._status =
      params.party === CancelingParty.School ? SessionStatus.CanceledBySchool : SessionStatus.CanceledByStudent;

    this.record(
      new ClassSessionCanceled({
        sessionId: this.id.value,
        schoolId: this._schoolId.value,
        groupId: this._groupId.value,
        party: params.party,
        canceledByMembershipId: params.by.value,
        reason: this._cancellation.reason,
        noticeHours: this._cancellation.noticeHours,
        refundDue,
        start: this._slot.start,
      }),
    );
  }

  /**
   * Replanifica: esta clase se cierra y devuelve la que la sustituye.
   *
   * Se crean dos filas a propósito. Mover la fecha «en el sitio» borraría que
   * hubo un cambio, y esa es justamente la información que la escuela quiere
   * ver cuando un grupo se queja de que le mueven las clases.
   */
  rescheduleTo(params: {
    newSessionId: SessionId;
    newSlot: TimeSlot;
    reason: string;
    now: Date;
    room?: Room;
    teacherId?: TeacherId | null;
  }): ClassSession {
    this.assertOpen("replanificar");
    if (!params.newSlot.startsAfter(params.now)) {
      throw new CannotScheduleInThePastError(params.newSlot.start, params.now);
    }

    const previousStart = this._slot.start;
    this._status = SessionStatus.Rescheduled;

    const replacement = new ClassSession(
      params.newSessionId,
      this._schoolId,
      this._groupId,
      params.teacherId !== undefined ? params.teacherId : this._teacherId,
      params.newSlot,
      params.room ?? this._room,
      SessionStatus.Scheduled,
      this._topic,
      this._contentUnitId,
      null,
      this.id,
      null,
      null,
    );

    this.record(
      new ClassSessionRescheduled({
        sessionId: this.id.value,
        schoolId: this._schoolId.value,
        replacementSessionId: params.newSessionId.value,
        previousStart,
        newStart: params.newSlot.start,
        reason: params.reason,
      }),
    );
    replacement.record(
      new ClassSessionScheduled({
        sessionId: params.newSessionId.value,
        schoolId: this._schoolId.value,
        groupId: this._groupId.value,
        teacherId: replacement._teacherId?.value ?? null,
        start: params.newSlot.start,
        end: params.newSlot.end,
        roomProvider: replacement._room.provider,
      }),
    );
    return replacement;
  }

  start(now: Date): void {
    this.assertOpen("empezar");
    if (this._status === SessionStatus.InProgress) return;
    this._status = SessionStatus.InProgress;
    this._actualStart = now;
  }

  /**
   * Cierra la clase.
   *
   * Si nadie llegó a conectarse, el estado no es «completada» sino
   * «sin asistentes»: son cosas distintas para la facturación y para el
   * indicador de asistencia.
   */
  complete(params: { now: Date; anyoneAttended: boolean }): void {
    this.assertOpen("completar");

    this._actualStart ??= this._slot.start;
    this._actualEnd = params.now;

    if (!params.anyoneAttended) {
      this._status = SessionStatus.NoShow;
      return;
    }

    this._status = SessionStatus.Completed;
    this.record(
      new ClassSessionCompleted({
        sessionId: this.id.value,
        schoolId: this._schoolId.value,
        groupId: this._groupId.value,
        teacherId: this._teacherId?.value ?? null,
        actualMinutes: this.actualMinutes ?? this._slot.durationMinutes,
        roomProvider: this._room.provider,
        transcriptionCapable: this._room.supportsLiveTranscription,
      }),
    );
  }

  assignTeacher(teacherId: TeacherId | null): void {
    this.assertOpen("cambiar el profesor de");
    this._teacherId = teacherId;
  }

  attachContentUnit(contentUnitId: string | null): void {
    this._contentUnitId = contentUnitId;
  }

  private assertOpen(action: string): void {
    if (CLOSED_STATUSES.includes(this._status)) {
      throw new SessionAlreadyClosedError(this.id.value, this._status, action);
    }
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get groupId(): GroupId {
    return this._groupId;
  }
  get teacherId(): TeacherId | null {
    return this._teacherId;
  }
  get slot(): TimeSlot {
    return this._slot;
  }
  get room(): Room {
    return this._room;
  }
  get status(): SessionStatus {
    return this._status;
  }
  get topic(): string | null {
    return this._topic;
  }
  get contentUnitId(): string | null {
    return this._contentUnitId;
  }
  get cancellation(): Cancellation | null {
    return this._cancellation;
  }
  get rescheduledFrom(): SessionId | null {
    return this._rescheduledFrom;
  }
  get actualStart(): Date | null {
    return this._actualStart;
  }
  get actualEnd(): Date | null {
    return this._actualEnd;
  }

  get actualMinutes(): number | null {
    if (!this._actualStart || !this._actualEnd) return null;
    return Math.round((this._actualEnd.getTime() - this._actualStart.getTime()) / 60_000);
  }

  get isOpen(): boolean {
    return !CLOSED_STATUSES.includes(this._status);
  }

  /** Cuenta para la ocupación del profesor: lo dado y lo comprometido. */
  get countsTowardsOccupancy(): boolean {
    return (
      this._status === SessionStatus.Scheduled ||
      this._status === SessionStatus.InProgress ||
      this._status === SessionStatus.Completed
    );
  }
}
