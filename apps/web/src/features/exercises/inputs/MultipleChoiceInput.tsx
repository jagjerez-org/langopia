import type { ReactElement } from "react";
import { readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";
import { ChoiceGroup } from "./ChoiceGroup.js";

/**
 * `multiple_choice`. `prompt`: `question` y `options[]` (de 2 a 6).
 *
 * `response`: `{ correct: <índice elegido> }` — la misma clave que
 * `solution.correct`, que es contra lo que compara `scoreAutomatically`.
 */
export function MultipleChoiceInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
}: ExerciseInputProps): ReactElement {
  return (
    <ChoiceGroup
      legend={readString(prompt, "question")}
      options={readStringArray(prompt, "options")}
      name={fieldPrefix}
      selected={typeof value?.["correct"] === "number" ? (value["correct"] as number) : null}
      onSelect={(index) => onChange({ correct: index })}
    />
  );
}
