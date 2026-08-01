import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * El profesor dejó constancia de cómo va un alumno.
 *
 * Sin `strengths`/`improvements`/`nextSteps`: son texto libre sobre una
 * persona identificable, a veces menor de edad, y este evento puede acabar en
 * un registro. Lo único que otro contexto necesita —el panel de dirección, la
 * futura métrica de productividad docente (ola 3)— es que la valoración
 * ocurrió, con qué puntuación y para quién, no su contenido.
 */
export class StudentEvaluated extends DomainEvent {
  readonly eventName = "assessment.student.evaluated";

  constructor(
    private readonly data: {
      evaluationId: string;
      schoolId: string;
      teacherProfileId: string;
      studentProfileId: string;
      periodStart: Date;
      periodEnd: Date;
      progressRating: number;
      visibleToGuardian: boolean;
    },
  ) {
    super({ aggregateId: data.evaluationId, schoolId: data.schoolId });
  }

  payload() {
    return {
      evaluationId: this.data.evaluationId,
      teacherProfileId: this.data.teacherProfileId,
      studentProfileId: this.data.studentProfileId,
      periodStart: this.data.periodStart.toISOString(),
      periodEnd: this.data.periodEnd.toISOString(),
      progressRating: this.data.progressRating,
      visibleToGuardian: this.data.visibleToGuardian,
    };
  }
}
