import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import { AudioPlayer } from "../AudioPlayer.js";
import { readNumber, readString } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `shadowing` (repetir sobre la marcha). `prompt`: `audioRef`, `target` (lo
 * que hay que repetir) y `maxDelayMs`.
 *
 * Es el único tipo sin `solution` y sin rúbrica: la API no puede corregirlo
 * automáticamente, así que el intento se queda en `submitted` y lo firma el
 * profesor. `response`: `{ completed: true }` — el alumno confirma que lo ha
 * repetido.
 *
 * No se manda ninguna grabación porque **no hay dónde guardarla**: este
 * entorno no tiene credenciales de almacenamiento y la API no expone ninguna
 * subida para intentos. El seed usa `{ recordingKey, delayMs }` para un
 * intento grabado en clase; aquí, sin grabación, se manda solo la
 * confirmación en vez de inventar una clave que no apunta a nada.
 */
export function ShadowingInput({ prompt, value, onChange, fieldPrefix, audioSrc }: ExerciseInputProps): ReactElement {
  const t = useT();
  const target = readString(prompt, "target");
  const maxDelayMs = readNumber(prompt, "maxDelayMs");
  const completed = value?.["completed"] === true;

  return (
    <div className="flex flex-col gap-3">
      <AudioPlayer src={audioSrc} label={t("exercises.audio.shadowingLabel")} />
      <p className="font-medium">{target}</p>
      {maxDelayMs !== undefined && (
        <p className="text-sm">{t("exercises.shadowing.maxDelay", { milliseconds: maxDelayMs })}</p>
      )}
      <p className="text-sm">{t("exercises.shadowing.noRecordingHint")}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`${fieldPrefix}-completed`}
          checked={completed}
          onChange={(event) => onChange({ completed: event.target.checked })}
        />
        <span>{t("exercises.shadowing.confirmLabel")}</span>
      </label>
    </div>
  );
}
