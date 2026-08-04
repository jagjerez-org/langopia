import type { ReactElement } from "react";
import { Selector } from "@langopia/ui";
import { useT } from "../../../i18n/translate.js";
import { readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `matching` (emparejar). `prompt`: `left[]` y `right[]` del mismo tamaño.
 *
 * `response`: `{ pairs: [[índiceIzquierda, índiceDerecha], ...] }`, la misma
 * clave y la misma forma que `solution.pairs`.
 *
 * Dos decisiones de forma, ninguna de negocio:
 *
 *  · Los pares van **en orden de `left`** (0, 1, 2…). `scoreAutomatically`
 *    compara los arrays POSICIÓN a POSICIÓN, así que un orden distinto del
 *    de la solución desalinearía respuestas correctas.
 *  · Un elemento sin emparejar viaja como `[i, -1]` en vez de desaparecer:
 *    quitarlo correría todos los pares siguientes una posición y convertiría
 *    aciertos en fallos. `-1` no existe como índice de `right`, así que
 *    simplemente no coincide con nada, que es justo lo que ha pasado.
 */
const UNANSWERED = -1;

export function MatchingInput({ prompt, value, onChange, fieldPrefix }: ExerciseInputProps): ReactElement {
  const t = useT();
  const left = readStringArray(prompt, "left");
  const right = readStringArray(prompt, "right");

  const currentPairs = readPairs(value?.["pairs"], left.length);

  const chosenFor = (leftIndex: number): number => currentPairs[leftIndex] ?? UNANSWERED;

  const choose = (leftIndex: number, rightIndex: number): void => {
    const next = [...currentPairs];
    next[leftIndex] = rightIndex;
    onChange({ pairs: next.map((rightValue, index) => [index, rightValue ?? UNANSWERED]) });
  };

  return (
    <div className="flex flex-col gap-3">
      {left.map((item, leftIndex) => (
        <Selector
          key={leftIndex}
          label={item}
          value={chosenFor(leftIndex) === UNANSWERED ? "" : String(chosenFor(leftIndex))}
          onChange={(event) => choose(leftIndex, Number(event.target.value))}
          placeholder={t("exercises.matching.choosePlaceholder")}
          options={right.map((option, rightIndex) => ({ value: String(rightIndex), label: option }))}
          id={`${fieldPrefix}-left-${leftIndex}`}
        />
      ))}
    </div>
  );
}

/** Reconstruye el estado por índice de `left` a partir de la respuesta en curso. */
function readPairs(raw: unknown, size: number): number[] {
  const pairs: number[] = Array.from({ length: size }, () => UNANSWERED);
  if (!Array.isArray(raw)) return pairs;
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [leftIndex, rightIndex] = entry;
    if (typeof leftIndex !== "number" || typeof rightIndex !== "number") continue;
    if (leftIndex >= 0 && leftIndex < size) pairs[leftIndex] = rightIndex;
  }
  return pairs;
}
