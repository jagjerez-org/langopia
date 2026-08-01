import { Command } from "@nestjs/cqrs";
import type { PlacementTestSnapshot } from "../../../domain/model/placement-test.aggregate.js";

/** La pregunta que toca responder ahora mismo, tal como la sirvió el banco. */
export interface NextPlacementQuestion {
  itemId: string;
  skill: string;
  level: string;
  prompt: Record<string, unknown>;
}

export interface StartPlacementTestResult {
  testId: string;
  finished: false;
  nextQuestion: NextPlacementQuestion;
  /**
   * El estado completo de la prueba, para devolver TAL CUAL en la siguiente
   * llamada a `AnswerPlacementTestCommand`. No hay tabla de «prueba en
   * curso» en el esquema de esta ola (solo el banco de ítems ya calibrados,
   * `placement_items`): el snapshot es la persistencia, y viaja por fuera
   * del servidor (`PlacementTest`, cabecera de la clase).
   */
  snapshot: PlacementTestSnapshot;
}

/**
 * Empieza una prueba de nivelación para un alumno. Quien la ejecuta no tiene
 * por qué ser el propio alumno —un profesor puede administrarla en persona,
 * igual que `SubmitAttemptCommand` con los intentos—; el portal del alumno
 * (ola futura) resolverá `studentProfileId` de su propia sesión.
 */
export class StartPlacementTestCommand extends Command<StartPlacementTestResult> {
  constructor(
    readonly props: {
      studentProfileId: string;
      language: string;
    },
  ) {
    super();
  }
}
