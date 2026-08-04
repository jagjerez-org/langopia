import type { ReactElement } from "react";
import { Input, Selector } from "@langopia/ui";
import { useT } from "../../../i18n/translate.js";
import { readObjectArray, readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `cloze` (huecos). `prompt`: `text` con marcadores `{{n}}`, `blanks[]` con
 * `id` y `hint` opcional, `openEnded`, y `options[]` cuando NO es abierto.
 *
 * `response`: una entrada por hueco, con el `id` del hueco como clave —
 * exactamente las claves de `solution` (`{"1": ["desde"], "2": [...]}`), que
 * es contra lo que `scoreAutomatically` compara, dando crédito parcial por
 * cada hueco acertado.
 *
 * El hueco abierto se escribe; el cerrado se elige entre `options`. Esa
 * diferencia la marca el propio ejercicio (`openEnded`), no este componente.
 */
export function ClozeInput({ prompt, value, onChange, fieldPrefix }: ExerciseInputProps): ReactElement {
  const t = useT();
  const text = readString(prompt, "text");
  const openEnded = prompt["openEnded"] !== false;
  const options = readStringArray(prompt, "options");
  const blanks = readObjectArray(prompt, "blanks")
    .map((blank) => ({
      id: typeof blank["id"] === "number" ? blank["id"] : null,
      hint: typeof blank["hint"] === "string" ? blank["hint"] : undefined,
    }))
    .filter((blank): blank is { id: number; hint: string | undefined } => blank.id !== null);

  const answerFor = (id: number): string => {
    const current = value?.[String(id)];
    return typeof current === "string" ? current : "";
  };

  const setAnswer = (id: number, answer: string): void => {
    onChange({ ...(value ?? {}), [String(id)]: answer });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-line">{renderTextWithMarkers(text)}</p>

      {blanks.map((blank) =>
        openEnded ? (
          <Input
            key={blank.id}
            label={t("exercises.cloze.blankLabel", { number: blank.id })}
            hint={blank.hint}
            value={answerFor(blank.id)}
            onChange={(event) => setAnswer(blank.id, event.target.value)}
            id={`${fieldPrefix}-blank-${blank.id}`}
          />
        ) : (
          <Selector
            key={blank.id}
            label={t("exercises.cloze.blankLabel", { number: blank.id })}
            hint={blank.hint}
            value={answerFor(blank.id)}
            onChange={(event) => setAnswer(blank.id, event.target.value)}
            placeholder={t("exercises.cloze.choosePlaceholder")}
            options={options.map((option) => ({ value: option, label: option }))}
            id={`${fieldPrefix}-blank-${blank.id}`}
          />
        ),
      )}
    </div>
  );
}

/**
 * `{{1}}` → `(1)`: el marcador crudo del enunciado no es texto que el alumno
 * deba leer, pero el número sí — es lo que enlaza cada hueco con su campo.
 */
function renderTextWithMarkers(text: string): string {
  return text.replace(/\{\{(\d+)\}\}/g, "($1)");
}
