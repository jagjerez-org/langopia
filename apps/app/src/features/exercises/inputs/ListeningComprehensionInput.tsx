import type { ReactElement } from "react";
import { useT } from "../../../i18n/translate.js";
import { AudioPlayer } from "../AudioPlayer.js";
import { ChoiceGroup } from "./ChoiceGroup.js";
import { readNumber, readString, readStringArray } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `listening_comprehension`. `prompt`: `audioRef`, `question` y `options[]`
 * (y, en el material del seed, un `playbackRate` sugerido).
 *
 * `response`: `{ correct: <índice elegido> }`, la misma clave que
 * `solution.correct`.
 */
export function ListeningComprehensionInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
  audioSrc,
}: ExerciseInputProps): ReactElement {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <AudioPlayer
        src={audioSrc}
        label={t("exercises.audio.listeningLabel")}
        initialRate={readNumber(prompt, "playbackRate")}
      />
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
