import type { ReactElement } from "react";
import { useT } from "../../i18n/translate.js";
import { readObjectArray, readStringArray } from "./inputs/props.js";
import type { ExerciseResponse } from "./types.js";

/**
 * Lo que contestó el alumno, legible para quien va a firmarlo (Paso 5).
 *
 * Se lee por la FORMA de la respuesta, no por el tipo de ejercicio — el mismo
 * criterio que usa `scoreAutomatically` en el servidor—: `correct` es un
 * índice de `options`, `sequence` una elección por par mínimo, `order` una
 * permutación de `tokens`, y una clave numérica suelta es un hueco de un
 * `cloze`. Así un tipo nuevo que reutilice una de esas formas ya se lee bien.
 *
 * Nunca se enseña la `solution`: la API no la manda a esta bandeja a
 * propósito (el profesor firma con su criterio, no comparando contra la
 * corrección automática).
 */
export function AttemptResponseSummary({
  prompt,
  response,
}: {
  prompt: Record<string, unknown>;
  response: ExerciseResponse;
}): ReactElement {
  const t = useT();
  const lines = summarise(prompt, response, t);

  if (lines.length === 0) {
    return <p className="text-sm">{t("exercises.inbox.responseEmpty")}</p>;
  }

  return (
    <ul className="text-sm list-disc pl-5">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

function summarise(
  prompt: Record<string, unknown>,
  response: ExerciseResponse,
  t: Translate,
): string[] {
  const lines: string[] = [];

  const text = response["text"];
  if (typeof text === "string" && text.length > 0) lines.push(text);

  const correct = response["correct"];
  if (typeof correct === "number") {
    const options = readStringArray(prompt, "options");
    lines.push(options[correct] ?? t("exercises.inbox.responseUnknownOption", { index: correct }));
  }

  const sequence = response["sequence"];
  if (Array.isArray(sequence)) {
    const pairs = readObjectArray(prompt, "pairs");
    sequence.forEach((side, index) => {
      const pair = pairs[index];
      const chosen = pair && (side === "a" || side === "b") ? pair[side] : undefined;
      lines.push(
        t("exercises.inbox.responseSequenceItem", {
          number: index + 1,
          word: typeof chosen === "string" ? chosen : t("exercises.inbox.responseNoAnswer"),
        }),
      );
    });
  }

  const segments = response["segments"];
  if (Array.isArray(segments)) {
    segments.forEach((segment, index) => {
      lines.push(
        t("exercises.inbox.responseSegmentItem", {
          number: index + 1,
          text: typeof segment === "string" && segment.length > 0 ? segment : t("exercises.inbox.responseNoAnswer"),
        }),
      );
    });
  }

  const order = response["order"];
  if (Array.isArray(order)) {
    const tokens = readStringArray(prompt, "tokens");
    lines.push(order.map((index) => (typeof index === "number" ? (tokens[index] ?? "") : "")).join(" "));
  }

  const pairsResponse = response["pairs"];
  if (Array.isArray(pairsResponse)) {
    const left = readStringArray(prompt, "left");
    const right = readStringArray(prompt, "right");
    for (const entry of pairsResponse) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [leftIndex, rightIndex] = entry;
      if (typeof leftIndex !== "number") continue;
      lines.push(
        t("exercises.inbox.responsePairItem", {
          left: left[leftIndex] ?? "",
          right:
            typeof rightIndex === "number" && right[rightIndex] !== undefined
              ? right[rightIndex]
              : t("exercises.inbox.responseNoAnswer"),
        }),
      );
    }
  }

  if (response["completed"] === true) lines.push(t("exercises.inbox.responseCompleted"));

  // Huecos de un `cloze`: claves numéricas sueltas, una por hueco.
  for (const [key, answer] of Object.entries(response)) {
    if (!/^\d+$/.test(key)) continue;
    lines.push(
      t("exercises.inbox.responseBlankItem", {
        number: Number(key),
        text: typeof answer === "string" && answer.length > 0 ? answer : t("exercises.inbox.responseNoAnswer"),
      }),
    );
  }

  return lines;
}
