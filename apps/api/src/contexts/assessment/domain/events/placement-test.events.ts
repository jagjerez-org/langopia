import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado `PlacementTest` (Tarea 8 de la ola 2).
 *
 * Solo se emiten en los dos hechos que de verdad importan a quien escuche
 * desde fuera: que un alumno empezó una prueba, y que terminó con un
 * resultado. `answer()` no emite nada por cada pregunta —igual que
 * `Evaluation.revise()` no emite nada—: no es un hecho de negocio, es
 * progreso interno de la prueba.
 */

/** Un alumno empieza la prueba de nivelación. Arranca siempre en B1. */
export class PlacementTestStarted extends DomainEvent {
  readonly eventName = "assessment.placement_test.started";

  constructor(
    private readonly data: {
      placementTestId: string;
      schoolId: string;
      studentProfileId: string;
      language: string;
    },
  ) {
    super({ aggregateId: data.placementTestId, schoolId: data.schoolId });
  }

  payload() {
    return {
      placementTestId: this.data.placementTestId,
      studentProfileId: this.data.studentProfileId,
      language: this.data.language,
    };
  }
}

/**
 * La prueba terminó: el algoritmo propone un nivel MCER y un desglose por
 * destreza. Es una PROPUESTA, no una decisión de expediente —igual que
 * `AttemptAiGraded` no cuenta hasta que el profesor valida—: ningún oyente
 * de este evento debería matricular al alumno ni tocar su nivel declarado
 * sin que alguien del equipo lo confirme antes.
 */
export class PlacementTestFinished extends DomainEvent {
  readonly eventName = "assessment.placement_test.finished";

  constructor(
    private readonly data: {
      placementTestId: string;
      schoolId: string;
      studentProfileId: string;
      language: string;
      level: string;
      skillLevels: Record<string, string>;
      questionsAsked: number;
    },
  ) {
    super({ aggregateId: data.placementTestId, schoolId: data.schoolId });
  }

  payload() {
    return {
      placementTestId: this.data.placementTestId,
      studentProfileId: this.data.studentProfileId,
      language: this.data.language,
      level: this.data.level,
      skillLevels: this.data.skillLevels,
      questionsAsked: this.data.questionsAsked,
    };
  }
}
