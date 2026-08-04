import type { ReactElement } from "react";
import { ChoiceGroup } from "./ChoiceGroup.js";
import { readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `reading_comprehension`. `prompt`: `passage`, `question` y `options[]`.
 *
 * `response`: `{ correct: <índice elegido> }`, la misma clave que
 * `solution.correct`.
 */
export function ReadingComprehensionInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
}: ExerciseInputProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-line">{readString(prompt, "passage")}</p>
      <ChoiceGroup
        legend={readString(prompt, "question")}
        options={readStringArray(prompt, "options")}
        name={fieldPrefix}
        selected={typeof value?.["correct"] === "number" ? (value["correct"] as number) : null}
        onSelect={(index) => onChange({ correct: index })}
      />
    </div>
  );
}
