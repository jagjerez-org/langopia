import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Selector } from "@langopia/ui";
import { useT } from "../../i18n/translate.js";

/**
 * Velocidades ofrecidas. 0,5× a 1,5× cubre lo que pide un dictado o un
 * `shadowing` (bajar para transcribir, subir para forzar la fluidez) sin
 * llegar a velocidades donde el navegador deja de resamplear y el audio se
 * vuelve ininteligible.
 */
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

/** Segundos → «m:ss», sin depender del locale (es un tiempo de pista, no una hora). */
export function formatPlaybackTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Dónde debe saltar la reproducción para repetir el fragmento A-B, o `null`
 * si no hay que tocar nada.
 *
 * Función pura y aparte del componente a propósito: es la única regla del
 * reproductor que merece prueba propia, y así se comprueba sin depender de
 * que jsdom implemente la reproducción de verdad (no lo hace).
 */
export function nextTimeForLoop(
  currentTime: number,
  start: number | null,
  end: number | null,
): number | null {
  if (start === null || end === null || end <= start) return null;
  if (currentTime >= end || currentTime < start) return start;
  return null;
}

export interface AudioPlayerProps {
  /**
   * URL reproducible. **Hoy la API nunca la manda**: `content_assets.
   * storage_key` no se puede firmar sin credenciales de almacenamiento y el
   * `prompt` solo trae un `audioRef` opaco. Sin `src` este componente enseña
   * su estado de «audio no disponible» traducido y el ejercicio se hace igual
   * (leyendo el enunciado), en vez de fingir un reproductor que no suena.
   */
  src?: string;
  /** Nombre accesible del reproductor: de qué es este audio. */
  label: string;
  /**
   * Velocidad inicial sugerida por el propio ejercicio (`prompt.playbackRate`
   * en el seed de `listening_comprehension`). Es una preferencia del material,
   * no una regla: el alumno la cambia cuando quiera.
   */
  initialRate?: number;
}

/**
 * Reproductor de audio de los ejercicios (Paso 2 del brief): velocidad
 * ajustable y repetición de un fragmento marcado A-B.
 *
 * Todo con el `<audio>` nativo: `playbackRate` es una propiedad del elemento y
 * la repetición es un salto de `currentTime` en `timeupdate`. Los controles
 * son botones y un `<select>` de verdad — enfocables con Tab y accionables con
 * teclado sin ningún manejador propio.
 */
export function AudioPlayer({ src, label, initialRate }: AudioPlayerProps): ReactElement {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(() => normaliseRate(initialRate));
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);
  const [playing, setPlaying] = useState(false);

  // `playbackRate` se fija sobre el elemento cada vez que cambia (y en cuanto
  // se monta): no es un atributo de `<audio>`, solo existe como propiedad.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !looping) return;
    const target = nextTimeForLoop(audio.currentTime, start, end);
    if (target !== null) audio.currentTime = target;
  }, [looping, start, end]);

  if (!src) {
    return (
      <p role="status" className="text-sm">
        {t("exercises.audio.unavailable")}
      </p>
    );
  }

  const togglePlay = (): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    // `play()` devuelve una promesa que el navegador rechaza si la política de
    // reproducción automática lo impide; y en jsdom no está implementada. En
    // ninguno de los dos casos hay nada que explicar al alumno más allá de que
    // el botón vuelva a decir «Reproducir».
    try {
      const started = audio.play() as Promise<void> | undefined;
      if (started) void started.catch(() => setPlaying(false));
    } catch {
      setPlaying(false);
    }
  };

  const mark = (which: "start" | "end"): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (which === "start") setStart(audio.currentTime);
    else setEnd(audio.currentTime);
  };

  const clearSegment = (): void => {
    setStart(null);
    setEnd(null);
    setLooping(false);
  };

  const segment = start !== null && end !== null && end > start ? { start, end } : null;

  return (
    <div className="flex flex-col gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />

      <div className="flex flex-wrap items-end gap-2">
        <Button variant="secondary" onClick={togglePlay}>
          {playing ? t("exercises.audio.pause") : t("exercises.audio.play")}
        </Button>

        <Selector
          label={t("exercises.audio.speedLabel")}
          value={String(rate)}
          onChange={(event) => setRate(Number(event.target.value))}
          options={PLAYBACK_RATES.map((value) => ({
            value: String(value),
            label: t("exercises.audio.speedOption", { rate: value }),
          }))}
        />

        <Button variant="ghost" onClick={() => mark("start")}>
          {t("exercises.audio.markStart")}
        </Button>
        <Button variant="ghost" onClick={() => mark("end")}>
          {t("exercises.audio.markEnd")}
        </Button>
      </div>

      {segment && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm">
            {t("exercises.audio.segmentRange", {
              start: formatPlaybackTime(segment.start),
              end: formatPlaybackTime(segment.end),
            })}
          </p>
          <Button
            variant={looping ? "primary" : "secondary"}
            aria-pressed={looping}
            onClick={() => setLooping((previous) => !previous)}
          >
            {looping ? t("exercises.audio.repeatOn") : t("exercises.audio.repeatOff")}
          </Button>
          <Button variant="ghost" onClick={clearSegment}>
            {t("exercises.audio.clearSegment")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Una velocidad fuera de la lista se queda en la más cercana ofrecida. */
function normaliseRate(candidate: number | undefined): number {
  if (candidate === undefined || !Number.isFinite(candidate)) return 1;
  return PLAYBACK_RATES.reduce((best, option) =>
    Math.abs(option - candidate) < Math.abs(best - candidate) ? option : best,
  );
}
