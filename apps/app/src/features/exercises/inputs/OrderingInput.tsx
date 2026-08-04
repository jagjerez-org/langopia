import type { ReactElement } from "react";
import { Button } from "@langopia/ui";
import { useT } from "../../../i18n/translate.js";
import { readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `ordering` (ordenar palabras). `prompt`: `tokens[]` (de 3 a 12).
 *
 * `response`: `{ order: [...] }`, donde `order[i]` es el índice ORIGINAL del
 * token que el alumno ha puesto en la posición `i` — la misma clave y la misma
 * semántica que `solution.order`, que es una permutación de los índices de
 * `tokens`.
 *
 * Se ordena con botones de subir y bajar, no arrastrando: arrastrar no se
 * puede hacer con el teclado, y el brief del panel exige que todo se maneje
 * con teclado.
 */
export function OrderingInput({ prompt, value, onChange, fieldPrefix }: ExerciseInputProps): ReactElement {
  const t = useT();
  const tokens = readStringArray(prompt, "tokens");
  const order = readOrder(value?.["order"], tokens.length);

  const move = (position: number, delta: number): void => {
    const target = position + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const moved = next[position]!;
    next[position] = next[target]!;
    next[target] = moved;
    onChange({ order: next });
  };

  return (
    <ol className="flex flex-col gap-2">
      {order.map((tokenIndex, position) => (
        <li key={tokenIndex} className="flex items-center gap-2">
          <span className="min-w-24">{tokens[tokenIndex] ?? ""}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={position === 0}
            onClick={() => move(position, -1)}
            aria-label={t("exercises.ordering.moveUp", { token: tokens[tokenIndex] ?? "" })}
            id={`${fieldPrefix}-up-${position}`}
          >
            {t("exercises.ordering.up")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={position === order.length - 1}
            onClick={() => move(position, 1)}
            aria-label={t("exercises.ordering.moveDown", { token: tokens[tokenIndex] ?? "" })}
            id={`${fieldPrefix}-down-${position}`}
          >
            {t("exercises.ordering.down")}
          </Button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Sin respuesta en curso, el orden de partida es el del propio `prompt`
 * (`[0, 1, 2…]`): los tokens ya vienen desordenados del generador, así que no
 * hay nada que barajar aquí — barajarlos otra vez sería inventar el ejercicio.
 */
function readOrder(raw: unknown, size: number): number[] {
  const identity = Array.from({ length: size }, (_, index) => index);
  if (!Array.isArray(raw)) return identity;
  const candidate = raw.filter((item): item is number => typeof item === "number");
  const isPermutation =
    candidate.length === size && new Set(candidate).size === size && candidate.every((i) => i >= 0 && i < size);
  return isPermutation ? candidate : identity;
}
