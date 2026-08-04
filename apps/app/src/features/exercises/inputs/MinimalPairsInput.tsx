import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import { readObjectArray, readString } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `minimal_pairs` (pares mínimos). `prompt`: `pairs[]` con `a`, `b` y
 * `contrast`, y un `question` opcional.
 *
 * `response`: `{ sequence: ["a" | "b", ...] }`, una entrada por contraste y en
 * el mismo orden que `pairs` — la misma clave y forma que `solution.sequence`,
 * que `scoreAutomatically` compara posición a posición.
 *
 * Un contraste sin responder viaja como cadena vacía en su posición, no se
 * omite: quitarlo correría los siguientes y convertiría aciertos en fallos.
 */
export function MinimalPairsInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
}: ExerciseInputProps): ReactElement {
  const t = useT();
  const question = readString(prompt, "question");
  const pairs = readObjectArray(prompt, "pairs").map((pair) => ({
    a: typeof pair["a"] === "string" ? pair["a"] : "",
    b: typeof pair["b"] === "string" ? pair["b"] : "",
    contrast: typeof pair["contrast"] === "string" ? pair["contrast"] : "",
  }));

  const sequence = readSequence(value?.["sequence"], pairs.length);

  const choose = (index: number, side: "a" | "b"): void => {
    const next = [...sequence];
    next[index] = side;
    onChange({ sequence: next });
  };

  return (
    <div className="flex flex-col gap-3">
      {question && <p className="font-medium">{question}</p>}
      {pairs.map((pair, index) => (
        <fieldset key={index} className="flex flex-wrap items-center gap-3 border-0 p-0">
          <legend className="text-sm">
            {t("exercises.minimalPairs.itemLegend", { number: index + 1, contrast: pair.contrast })}
          </legend>
          {(["a", "b"] as const).map((side) => (
            <label key={side} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${fieldPrefix}-pair-${index}`}
                value={side}
                checked={sequence[index] === side}
                onChange={() => choose(index, side)}
              />
              <span>{pair[side]}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function readSequence(raw: unknown, size: number): string[] {
  const empty = Array.from({ length: size }, () => "");
  if (!Array.isArray(raw)) return empty;
  return empty.map((fallback, index) => {
    const item = raw[index];
    return item === "a" || item === "b" ? item : fallback;
  });
}
