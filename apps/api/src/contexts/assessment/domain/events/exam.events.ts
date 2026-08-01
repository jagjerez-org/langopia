import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado `Exam` (Tarea 15 de la ola 2).
 *
 * Ninguno lleva las respuestas del alumno ni el enunciado de los ítems: son
 * datos pedagógicos sobre una persona identificable, igual que
 * `AttemptAiGraded`/`AttemptTeacherValidated` no llevan la respuesta ni la
 * corrección completas.
 */

/** Un examen nace, generado a partir de unidades ya publicadas. */
export class ExamGenerated extends DomainEvent {
  readonly eventName = "assessment.exam.generated";

  constructor(
    private readonly data: {
      examId: string;
      schoolId: string;
      kind: string;
      studentProfileId: string;
      sourceContentUnitIds: readonly string[];
    },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return {
      examId: this.data.examId,
      kind: this.data.kind,
      studentProfileId: this.data.studentProfileId,
      sourceContentUnitIds: this.data.sourceContentUnitIds,
    };
  }
}

/** El alumno empieza a hacer el examen: arranca el cronómetro. */
export class ExamStarted extends DomainEvent {
  readonly eventName = "assessment.exam.started";

  constructor(
    private readonly data: { examId: string; schoolId: string; studentProfileId: string },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return { examId: this.data.examId, studentProfileId: this.data.studentProfileId };
  }
}

/** El alumno entrega el examen. */
export class ExamSubmitted extends DomainEvent {
  readonly eventName = "assessment.exam.submitted";

  constructor(
    private readonly data: { examId: string; schoolId: string; studentProfileId: string },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return { examId: this.data.examId, studentProfileId: this.data.studentProfileId };
  }
}

/**
 * La IA propuso una nota (agregando la corrección automática y por rúbrica de
 * cada ítem). Todavía NO cuenta para el expediente: solo
 * `ExamTeacherValidated` lo hace.
 */
export class ExamAiGraded extends DomainEvent {
  readonly eventName = "assessment.exam.ai_graded";

  constructor(
    private readonly data: {
      examId: string;
      schoolId: string;
      studentProfileId: string;
      aiScore: number;
    },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return {
      examId: this.data.examId,
      studentProfileId: this.data.studentProfileId,
      aiScore: this.data.aiScore,
    };
  }
}

/** El profesor firmó: esta es la única nota que cuenta para el expediente. */
export class ExamTeacherValidated extends DomainEvent {
  readonly eventName = "assessment.exam.teacher_validated";

  constructor(
    private readonly data: {
      examId: string;
      schoolId: string;
      studentProfileId: string;
      score: number;
      validatedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return {
      examId: this.data.examId,
      studentProfileId: this.data.studentProfileId,
      score: this.data.score,
      validatedByMembershipId: this.data.validatedByMembershipId,
    };
  }
}

/**
 * Un examen de nivel aprobado PROPONE subir de nivel MCER — nunca lo decide
 * solo. Ningún manejador de esta tarea consume este evento para tocar el
 * nivel declarado del alumno; queda para quien construya esa confirmación,
 * igual que `PlacementTestFinished` (Tarea 8).
 */
export class ExamLevelUpgradeProposed extends DomainEvent {
  readonly eventName = "assessment.exam.level_upgrade_proposed";

  constructor(
    private readonly data: {
      examId: string;
      schoolId: string;
      studentProfileId: string;
      proposedLevel: string;
    },
  ) {
    super({ aggregateId: data.examId, schoolId: data.schoolId });
  }

  payload() {
    return {
      examId: this.data.examId,
      studentProfileId: this.data.studentProfileId,
      proposedLevel: this.data.proposedLevel,
    };
  }
}
