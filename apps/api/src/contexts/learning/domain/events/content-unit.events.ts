import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado ContentUnit.
 *
 * Son el contrato con el resto del sistema. Quien los consume no importa
 * nada del dominio de Learning: solo primitivos.
 */

/**
 * La frontera donde una persona se hace responsable de lo que ve el alumno.
 * Mientras no se emita, la unidad no cuenta como material publicado para
 * ningún otro contexto.
 */
export class ContentUnitPublished extends DomainEvent {
  readonly eventName = "learning.content_unit.published";

  constructor(
    private readonly data: {
      contentUnitId: string;
      schoolId: string;
      courseId: string | null;
      language: string;
      level: string;
      reviewedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.contentUnitId, schoolId: data.schoolId });
  }

  payload() {
    return {
      contentUnitId: this.data.contentUnitId,
      courseId: this.data.courseId,
      language: this.data.language,
      level: this.data.level,
      reviewedByMembershipId: this.data.reviewedByMembershipId,
    };
  }
}

export class ContentUnitArchived extends DomainEvent {
  readonly eventName = "learning.content_unit.archived";

  constructor(private readonly data: { contentUnitId: string; schoolId: string }) {
    super({ aggregateId: data.contentUnitId, schoolId: data.schoolId });
  }

  payload() {
    return { contentUnitId: this.data.contentUnitId };
  }
}
