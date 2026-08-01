import { Command } from "@nestjs/cqrs";
import type {
  PlacementTestResult,
  PlacementTestSnapshot,
} from "../../../domain/model/placement-test.aggregate.js";
import type { NextPlacementQuestion } from "../start-placement-test/start-placement-test.command.js";

export interface AnswerPlacementTestResult {
  testId: string;
  finished: boolean;
  /** La siguiente pregunta, o `null` si la prueba ya terminó (mira `result`). */
  nextQuestion: NextPlacementQuestion | null;
  /** El nivel MCER propuesto y su desglose por destreza, o `null` mientras siga en curso. */
  result: PlacementTestResult | null;
  /** El estado tras esta respuesta, para la siguiente llamada. Mismo contrato que en `start`. */
  snapshot: PlacementTestSnapshot;
}

/**
 * Responde a la pregunta `itemId` de la prueba `testId`.
 *
 * `snapshot` es el que devolvió la llamada anterior (a `start` o a este
 * mismo comando) SIN modificar: es la persistencia de esta prueba mientras
 * no exista una tabla dedicada (`PlacementTest`, cabecera de la clase).
 */
export class AnswerPlacementTestCommand extends Command<AnswerPlacementTestResult> {
  constructor(
    readonly props: {
      testId: string;
      snapshot: PlacementTestSnapshot;
      itemId: string;
      response: Record<string, unknown>;
    },
  ) {
    super();
  }
}
