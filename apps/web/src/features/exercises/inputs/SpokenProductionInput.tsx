import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import { countWords, readNumber, readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `spoken_production` (expresión oral). `prompt`: `task`, `durationSeconds`, y
 * en el material del seed unos `prompts[]` de apoyo.
 *
 * `response`: `{ text, wordCount }`, igual que la expresión escrita. **No se
 * sube audio**: este entorno no tiene credenciales de almacenamiento y la API
 * no expone ninguna subida para intentos. El alumno escribe lo que ha dicho, y
 * ese texto es justo lo que el corrector por rúbrica sabe leer
 * (`attempt.response["text"]`); sin él, el intento se queda en `submitted` y
 * el profesor lo firma a mano igualmente.
 */
export function SpokenProductionInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
}: ExerciseInputProps): ReactElement {
  const t = useT();
  const task = readString(prompt, "task");
  const durationSeconds = readNumber(prompt, "durationSeconds");
  const supportPrompts = readStringArray(prompt, "prompts");
  const text = typeof value?.["text"] === "string" ? (value["text"] as string) : "";
  const textareaId = `${fieldPrefix}-text`;

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{task}</p>
      {durationSeconds !== undefined && (
        <p className="text-sm">{t("exercises.spoken.duration", { seconds: durationSeconds })}</p>
      )}
      {supportPrompts.length > 0 && (
        <ul className="text-sm list-disc pl-5">
          {supportPrompts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <label htmlFor={textareaId} className="font-medium">
        {t("exercises.spoken.transcriptLabel")}
      </label>
      <p className="text-sm">{t("exercises.spoken.noRecordingHint")}</p>
      <textarea
        id={textareaId}
        rows={6}
        value={text}
        onChange={(event) =>
          onChange({ text: event.target.value, wordCount: countWords(event.target.value) })
        }
      />
      <p role="status" className="text-sm">
        {t("exercises.spoken.wordCount", { count: countWords(text) })}
      </p>
    </div>
  );
}
