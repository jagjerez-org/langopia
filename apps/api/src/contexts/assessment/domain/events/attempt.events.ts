import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado `Attempt`.
 *
 * Son el contrato con el resto del sistema. Ninguno lleva la respuesta del
 * alumno ni el texto de la corrección: son datos pedagógicos sobre una
 * persona identificable, igual que `StudentEvaluated` no lleva
 * `strengths`/`improvements`/`nextSteps`.
 */

/** Un alumno envió un intento. Empieza el ciclo `submitted` → `ai_graded` → `teacher_validated`. */
export class AttemptSubmitted extends DomainEvent {
  readonly eventName = "assessment.attempt.submitted";

  constructor(
    private readonly data: {
      attemptId: string;
      schoolId: string;
      exerciseId: string;
      studentProfileId: string;
      attemptNumber: number;
    },
  ) {
    super({ aggregateId: data.attemptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      attemptId: this.data.attemptId,
      exerciseId: this.data.exerciseId,
      studentProfileId: this.data.studentProfileId,
      attemptNumber: this.data.attemptNumber,
    };
  }
}

/**
 * La IA (o la corrección automática) propuso una nota. Todavía NO cuenta para
 * el expediente: solo `AttemptTeacherValidated` lo hace.
 */
export class AttemptAiGraded extends DomainEvent {
  readonly eventName = "assessment.attempt.ai_graded";

  constructor(
    private readonly data: {
      attemptId: string;
      schoolId: string;
      exerciseId: string;
      studentProfileId: string;
      aiScore: number;
    },
  ) {
    super({ aggregateId: data.attemptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      attemptId: this.data.attemptId,
      exerciseId: this.data.exerciseId,
      studentProfileId: this.data.studentProfileId,
      aiScore: this.data.aiScore,
    };
  }
}

/**
 * El profesor firmó: esta es la única nota que cuenta para el expediente.
 * Lleva quién y cuándo, que es exactamente lo que exige la regla de la ola.
 */
export class AttemptTeacherValidated extends DomainEvent {
  readonly eventName = "assessment.attempt.teacher_validated";

  constructor(
    private readonly data: {
      attemptId: string;
      schoolId: string;
      exerciseId: string;
      studentProfileId: string;
      teacherScore: number;
      validatedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.attemptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      attemptId: this.data.attemptId,
      exerciseId: this.data.exerciseId,
      studentProfileId: this.data.studentProfileId,
      teacherScore: this.data.teacherScore,
      validatedByMembershipId: this.data.validatedByMembershipId,
    };
  }
}

/** El profesor devolvió el intento: el alumno rehace, sin que el anterior se borre. */
export class AttemptReturnedToStudent extends DomainEvent {
  readonly eventName = "assessment.attempt.returned_to_student";

  constructor(
    private readonly data: {
      attemptId: string;
      schoolId: string;
      exerciseId: string;
      studentProfileId: string;
      returnedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.attemptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      attemptId: this.data.attemptId,
      exerciseId: this.data.exerciseId,
      studentProfileId: this.data.studentProfileId,
      returnedByMembershipId: this.data.returnedByMembershipId,
    };
  }
}

/**
 * Un ejercicio con `requiresTeacherValidation` lleva más de 7 días en
 * `ai_graded`: la nota sigue sin contar y nadie lo ha firmado. Lo emite el
 * trabajo programado (`NotifyOverdueAttemptsJob`), no el agregado — no hay
 * transición de estado que lo acompañe, es un aviso sobre el tiempo que pasa.
 */
export class AttemptValidationOverdue extends DomainEvent {
  readonly eventName = "assessment.attempt.validation_overdue";

  constructor(
    private readonly data: {
      attemptId: string;
      schoolId: string;
      exerciseId: string;
      studentProfileId: string;
      submittedAt: Date;
    },
  ) {
    super({ aggregateId: data.attemptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      attemptId: this.data.attemptId,
      exerciseId: this.data.exerciseId,
      studentProfileId: this.data.studentProfileId,
      submittedAt: this.data.submittedAt.toISOString(),
    };
  }
}
