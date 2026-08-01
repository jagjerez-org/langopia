import { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { CancellingParty } from "../model/cancellation.vo.js";
import type { RoomProvider } from "../model/room.vo.js";

/**
 * Eventos del agregado ClassSession.
 *
 * Son el contrato con el resto del sistema. Quien los consume no importa
 * nada del dominio de Scheduling: solo primitivos.
 */

export class ClassSessionScheduled extends DomainEvent {
  readonly eventName = "scheduling.class_session.scheduled";

  constructor(
    private readonly data: {
      sessionId: string;
      schoolId: string;
      groupId: string;
      teacherId: string | null;
      start: Date;
      end: Date;
      roomProvider: RoomProvider;
    },
  ) {
    super({ aggregateId: data.sessionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      sessionId: this.data.sessionId,
      groupId: this.data.groupId,
      teacherId: this.data.teacherId,
      start: this.data.start.toISOString(),
      end: this.data.end.toISOString(),
      roomProvider: this.data.roomProvider,
    };
  }
}

/**
 * El evento que más escuchan los demás.
 *
 * `refundDue` lo decidió la política de cancelación de la escuela, no quien
 * llamó a la API. Facturación lo consume para abrir una devolución sin tener
 * que volver a razonar sobre horas de antelación.
 */
export class ClassSessionCanceled extends DomainEvent {
  readonly eventName = "scheduling.class_session.canceled";

  constructor(
    private readonly data: {
      sessionId: string;
      schoolId: string;
      groupId: string;
      party: CancellingParty;
      canceledByMembershipId: string;
      reason: string;
      noticeHours: number;
      refundDue: boolean;
      start: Date;
    },
  ) {
    super({ aggregateId: data.sessionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      sessionId: this.data.sessionId,
      groupId: this.data.groupId,
      party: this.data.party,
      canceledByMembershipId: this.data.canceledByMembershipId,
      reason: this.data.reason,
      noticeHours: this.data.noticeHours,
      refundDue: this.data.refundDue,
      start: this.data.start.toISOString(),
    };
  }
}

export class ClassSessionRescheduled extends DomainEvent {
  readonly eventName = "scheduling.class_session.rescheduled";

  constructor(
    private readonly data: {
      sessionId: string;
      schoolId: string;
      replacementSessionId: string;
      previousStart: Date;
      newStart: Date;
      reason: string;
    },
  ) {
    super({ aggregateId: data.sessionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      sessionId: this.data.sessionId,
      replacementSessionId: this.data.replacementSessionId,
      previousStart: this.data.previousStart.toISOString(),
      newStart: this.data.newStart.toISOString(),
      reason: this.data.reason,
    };
  }
}

export class ClassSessionCompleted extends DomainEvent {
  readonly eventName = "scheduling.class_session.completed";

  constructor(
    private readonly data: {
      sessionId: string;
      schoolId: string;
      groupId: string;
      teacherId: string | null;
      actualMinutes: number;
      roomProvider: RoomProvider;
      /** Solo el aula propia puede transcribir en directo. */
      transcriptionCapable: boolean;
    },
  ) {
    super({ aggregateId: data.sessionId, schoolId: data.schoolId });
  }

  payload() {
    return {
      sessionId: this.data.sessionId,
      groupId: this.data.groupId,
      teacherId: this.data.teacherId,
      actualMinutes: this.data.actualMinutes,
      roomProvider: this.data.roomProvider,
      transcriptionCapable: this.data.transcriptionCapable,
    };
  }
}
