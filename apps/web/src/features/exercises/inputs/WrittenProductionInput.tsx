import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import { countWords, readNumber, readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `written_production` (expresión escrita). `prompt`: `task`, `minWords`,
 * `maxWords`, `register`, y en el material del seed un `mustInclude[]`.
 *
 * `response`: `{ text, wordCount }` — la misma forma que ya guarda el seed.
 * `text` es lo que lee el corrector por rúbrica (`WritingCorrectorPort`).
 *
 * La extensión (`minWords`/`maxWords`) se ENSEÑA, no se impone: quien decide
 * si un texto corto vale es la rúbrica y, con ella, el profesor. Bloquear el
 * envío aquí sería una regla de negocio en el cliente.
 */
export function WrittenProductionInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
}: ExerciseInputProps): ReactElement {
  const t = useT();
  const task = readString(prompt, "task");
  const register = readString(prompt, "register");
  const minWords = readNumber(prompt, "minWords");
  const maxWords = readNumber(prompt, "maxWords");
  const mustInclude = readStringArray(prompt, "mustInclude");
  const text = typeof value?.["text"] === "string" ? (value["text"] as string) : "";
  const textareaId = `${fieldPrefix}-text`;

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{task}</p>
      {register && <p className="text-sm">{t("exercises.written.register", { register })}</p>}
      {minWords !== undefined && maxWords !== undefined && (
        <p className="text-sm">{t("exercises.written.wordRange", { min: minWords, max: maxWords })}</p>
      )}
      {mustInclude.length > 0 && (
        <ul className="text-sm list-disc pl-5">
          {mustInclude.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <label htmlFor={textareaId} className="font-medium">
        {t("exercises.written.textLabel")}
      </label>
      <textarea
        id={textareaId}
        rows={8}
        value={text}
        onChange={(event) =>
          onChange({ text: event.target.value, wordCount: countWords(event.target.value) })
        }
      />
      <p role="status" className="text-sm">
        {t("exercises.written.wordCount", { count: countWords(text) })}
      </p>
    </div>
  );
}
