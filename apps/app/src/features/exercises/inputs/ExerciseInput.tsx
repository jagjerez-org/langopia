import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import type { ExerciseType } from "../types.js";
import { ClozeInput } from "./ClozeInput.js";
import { DictationInput } from "./DictationInput.js";
import { ListeningComprehensionInput } from "./ListeningComprehensionInput.js";
import { MatchingInput } from "./MatchingInput.js";
import { MinimalPairsInput } from "./MinimalPairsInput.js";
import { MultipleChoiceInput } from "./MultipleChoiceInput.js";
import { OrderingInput } from "./OrderingInput.js";
import { ReadingComprehensionInput } from "./ReadingComprehensionInput.js";
import { ShadowingInput } from "./ShadowingInput.js";
import { SpokenProductionInput } from "./SpokenProductionInput.js";
import { WrittenProductionInput } from "./WrittenProductionInput.js";
import type { ExerciseInputProps } from "./props.js";

/** Un componente por tipo, los once (Paso 1 del brief). */
const INPUT_BY_TYPE: Record<ExerciseType, (props: ExerciseInputProps) => ReactElement> = {
  cloze: ClozeInput,
  multiple_choice: MultipleChoiceInput,
  matching: MatchingInput,
  ordering: OrderingInput,
  minimal_pairs: MinimalPairsInput,
  dictation: DictationInput,
  shadowing: ShadowingInput,
  listening_comprehension: ListeningComprehensionInput,
  reading_comprehension: ReadingComprehensionInput,
  written_production: WrittenProductionInput,
  spoken_production: SpokenProductionInput,
};

export interface ExerciseInputDispatchProps extends ExerciseInputProps {
  /** `exercises.type` llega como texto libre del modelo de lectura, no como unión. */
  type: string;
}

/**
 * Elige el componente que toca según el tipo del ejercicio.
 *
 * Un tipo desconocido —uno nuevo en la base que este panel todavía no sepa
 * pintar— no rompe la pantalla ni enseña un JSON crudo: dice que ese ejercicio
 * no se puede hacer aquí todavía, con su texto traducido.
 */
export function ExerciseInput({ type, ...rest }: ExerciseInputDispatchProps): ReactElement {
  const t = useT();
  const Component = INPUT_BY_TYPE[type as ExerciseType];
  if (!Component) {
    return <p role="status">{t("exercises.unsupportedType")}</p>;
  }
  return <Component {...rest} />;
}

/** La URL reproducible del audio, si algún día la API la mandara. Ver `AudioPlayer`. */
export function audioSrcFromPrompt(prompt: Record<string, unknown>): string | undefined {
  const candidate = prompt["audioUrl"];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}
