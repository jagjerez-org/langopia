import type { ReactElement } from "react";
import { Input } from "@langopia/ui";
import { useT } from "../../../i18n/translate.js";
import { AudioPlayer } from "../AudioPlayer.js";
import { readNumber, readString } from "./props.js";
import type { ExerciseInputProps } from "./props.js";

/**
 * `dictation` (dictado). `prompt`: `audioRef`, `segments` (cuántos) y un
 * `question` opcional.
 *
 * `response`: `{ segments: [...] }`, un texto por segmento y en el mismo
 * orden — la misma clave y forma que `solution.segments`, que
 * `scoreAutomatically` compara posición a posición.
 *
 * Es el ejercicio que más necesita el reproductor: bajar la velocidad y
 * repetir un fragmento es literalmente cómo se hace un dictado.
 */
export function DictationInput({
  prompt,
  value,
  onChange,
  fieldPrefix,
  audioSrc,
}: ExerciseInputProps): ReactElement {
  const t = useT();
  const question = readString(prompt, "question");
  const count = readNumber(prompt, "segments") ?? 0;
  const segments = readSegments(value?.["segments"], count);

  const write = (index: number, text: string): void => {
    const next = [...segments];
    next[index] = text;
    onChange({ segments: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <AudioPlayer src={audioSrc} label={t("exercises.audio.dictationLabel")} />
      {question && <p className="font-medium">{question}</p>}
      {segments.map((text, index) => (
        <Input
          key={index}
          label={t("exercises.dictation.segmentLabel", { number: index + 1 })}
          value={text}
          onChange={(event) => write(index, event.target.value)}
          id={`${fieldPrefix}-segment-${index}`}
        />
      ))}
    </div>
  );
}

function readSegments(raw: unknown, size: number): string[] {
  const empty = Array.from({ length: size }, () => "");
  if (!Array.isArray(raw)) return empty;
  return empty.map((fallback, index) => {
    const item = raw[index];
    return typeof item === "string" ? item : fallback;
  });
}
