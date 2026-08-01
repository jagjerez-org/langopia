import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado `Group`.
 *
 * Contrato público de `catalog` con el resto del sistema: quien los consume
 * no importa nada de este dominio, solo primitivos.
 */

export class StudentEnrolledInGroup extends DomainEvent {
  readonly eventName = "catalog.group.student_enrolled";

  constructor(
    private readonly data: {
      groupId: string;
      schoolId: string;
      enrollmentId: string;
      studentId: string;
    },
  ) {
    super({ aggregateId: data.groupId, schoolId: data.schoolId });
  }

  payload() {
    return {
      groupId: this.data.groupId,
      enrollmentId: this.data.enrollmentId,
      studentId: this.data.studentId,
    };
  }
}

/** Se emite justo cuando la matrícula que se acaba de aceptar agota la capacidad. */
export class GroupFull extends DomainEvent {
  readonly eventName = "catalog.group.full";

  constructor(private readonly data: { groupId: string; schoolId: string; capacity: number }) {
    super({ aggregateId: data.groupId, schoolId: data.schoolId });
  }

  payload() {
    return { groupId: this.data.groupId, capacity: this.data.capacity };
  }
}

export class GroupStarted extends DomainEvent {
  readonly eventName = "catalog.group.started";

  constructor(
    private readonly data: { groupId: string; schoolId: string; startedAt: Date },
  ) {
    super({ aggregateId: data.groupId, schoolId: data.schoolId });
  }

  payload() {
    return { groupId: this.data.groupId, startedAt: this.data.startedAt.toISOString() };
  }
}
