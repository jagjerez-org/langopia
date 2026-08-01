import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { RubricScoreMismatchError } from "../errors/assessment.errors.js";

export type RubricCriterion = {
  key: string;
  label: string;
  weight: number;
  descriptors: readonly string[];
};

/**
 * Cada criterio se puntúa en esta escala (0 a 5) antes de ponderarse: son los
 * mismos cuatro niveles que describen los `descriptors` de cada criterio del
 * seed (`packages/db/src/seed/reference.ts`), con margen para matices entre
 * ellos. `weightedScore` es quien escala el resultado a `maxScore`.
 */
const MAX_CRITERION_SCORE = 5;

type RubricProps = {
  id: string;
  code: string;
  maxScore: number;
  criteria: readonly RubricCriterion[];
};

/**
 * Objeto de valor: la rúbrica de corrección de un ejercicio sin «correcto»
 * automático (`written_production`, `spoken_production`).
 *
 * No es un agregado —no tiene ciclo de vida propio dentro de `assessment`,
 * solo se lee desde `learning` vía `ExerciseSourcePort` para poder puntuar
 * una corrección—, así que se compara por valor, no por identidad.
 *
 * Encapsula las dos reglas que hacen que una corrección por rúbrica sea
 * fiable: que trae EXACTAMENTE los criterios que pide la rúbrica (ni
 * inventados ni omitidos) y cómo esos criterios, puntuados de 0 a 5, se
 * convierten en la nota final del ejercicio.
 */
export class Rubric extends ValueObject<RubricProps> {
  private constructor(props: RubricProps) {
    super(props);
  }

  static reconstitute(props: RubricProps): Rubric {
    return new Rubric({ ...props, criteria: [...props.criteria] });
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get maxScore(): number {
    return this.props.maxScore;
  }
  get criteria(): readonly RubricCriterion[] {
    return this.props.criteria;
  }

  criterionKeys(): ReadonlySet<string> {
    return new Set(this.props.criteria.map((c) => c.key));
  }

  /**
   * `scores` (el `byCriterion` que devuelve el corrector) tiene que traer
   * EXACTAMENTE una entrada por cada criterio de esta rúbrica: ni un
   * criterio inventado, ni uno omitido.
   */
  assertMatchesCriteria(scores: Record<string, number>): void {
    const expected = this.criterionKeys();
    const received = new Set(Object.keys(scores));
    const same = received.size === expected.size && [...expected].every((k) => received.has(k));
    if (!same) {
      throw new RubricScoreMismatchError(this.props.code, [...expected], [...received]);
    }
  }

  /**
   * Convierte una puntuación de 0 a 5 por criterio en la nota final, sobre
   * `maxScore`, ponderando por el peso de cada criterio. Los pesos de una
   * rúbrica suman 1 (`WRITING_RUBRIC`, `SPEAKING_RUBRIC` en el seed), así que
   * la media ponderada queda ya en la escala 0–5 antes de reescalarla.
   */
  weightedScore(scores: Record<string, number>): number {
    this.assertMatchesCriteria(scores);
    const weightedAverage = this.props.criteria.reduce(
      (sum, c) => sum + scores[c.key]! * c.weight,
      0,
    );
    return (weightedAverage / MAX_CRITERION_SCORE) * this.props.maxScore;
  }
}
