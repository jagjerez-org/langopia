import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer, formatPlaybackTime, nextTimeForLoop } from "./AudioPlayer.js";

/**
 * Un WAV mínimo (44 bytes de cabecera, sin muestras) como `data:` URI: basta
 * para que el `<audio>` tenga un `src` de verdad —el brief lo pide así— sin
 * depender de ningún fichero ni de ninguna red.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function audioElement(container: HTMLElement): HTMLAudioElement {
  const audio = container.querySelector("audio");
  if (!audio) throw new Error("no se pintó ningún <audio>");
  return audio;
}

describe("AudioPlayer (Paso 2 de la Tarea 12: velocidad y repetición de fragmento)", () => {
  beforeEach(() => {
    // jsdom no reproduce nada: ni implementa `play()`/`pause()` ni deja mover
    // `currentTime`. Se sustituyen por propiedades normales para poder
    // colocar la reproducción donde haga falta y comprobar adónde salta.
    for (const property of ["currentTime", "playbackRate", "paused"] as const) {
      Object.defineProperty(HTMLMediaElement.prototype, property, {
        configurable: true,
        writable: true,
        value: property === "paused" ? true : property === "playbackRate" ? 1 : 0,
      });
    }
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it("sin `src` no finge un reproductor: dice que el audio no está disponible", () => {
    const { container } = render(<AudioPlayer label="Audio del dictado" />);

    screen.getByText("El audio de este ejercicio no está disponible todavía.");
    expect(container.querySelector("audio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reproducir" })).toBeNull();
  });

  it("con `src` reproduce y la velocidad elegida llega al elemento de audio", async () => {
    const user = userEvent.setup();
    const { container } = render(<AudioPlayer src={SILENT_WAV} label="Audio del dictado" />);
    const audio = audioElement(container);

    expect(audio.getAttribute("src")).toBe(SILENT_WAV);
    expect(audio.playbackRate).toBe(1);

    await user.click(screen.getByRole("button", { name: "Reproducir" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Velocidad"), "0.75");
    expect(audio.playbackRate).toBe(0.75);

    await user.selectOptions(screen.getByLabelText("Velocidad"), "1.5");
    expect(audio.playbackRate).toBe(1.5);
  });

  it("la velocidad sugerida por el ejercicio se aplica al montar, redondeada a una de las ofrecidas", () => {
    const { container } = render(
      <AudioPlayer src={SILENT_WAV} label="Audio de comprensión auditiva" initialRate={0.92} />,
    );

    // 0,92 no está en la lista: la más cercana ofrecida es 1.
    expect(audioElement(container).playbackRate).toBe(1);
  });

  it("marcar A y B y repetir: al pasar del final, la reproducción vuelve al inicio del fragmento", async () => {
    const user = userEvent.setup();
    const { container } = render(<AudioPlayer src={SILENT_WAV} label="Audio del dictado" />);
    const audio = audioElement(container);

    audio.currentTime = 5;
    await user.click(screen.getByRole("button", { name: "Marcar inicio" }));
    audio.currentTime = 9;
    await user.click(screen.getByRole("button", { name: "Marcar fin" }));

    screen.getByText("Fragmento: de 0:05 a 0:09");

    const repeat = screen.getByRole("button", { name: "Repetir el fragmento" });
    expect(repeat.getAttribute("aria-pressed")).toBe("false");

    // Sin repetición activa, avanzar más allá del final no toca nada.
    audio.currentTime = 12;
    fireEvent.timeUpdate(audio);
    expect(audio.currentTime).toBe(12);

    await user.click(repeat);
    expect(screen.getByRole("button", { name: "Repitiendo el fragmento" }).getAttribute("aria-pressed")).toBe("true");

    audio.currentTime = 9.5;
    fireEvent.timeUpdate(audio);
    expect(audio.currentTime).toBe(5);
  });

  it("quitar el fragmento apaga la repetición y esconde sus controles", async () => {
    const user = userEvent.setup();
    const { container } = render(<AudioPlayer src={SILENT_WAV} label="Audio del dictado" />);
    const audio = audioElement(container);

    audio.currentTime = 2;
    await user.click(screen.getByRole("button", { name: "Marcar inicio" }));
    audio.currentTime = 6;
    await user.click(screen.getByRole("button", { name: "Marcar fin" }));
    await user.click(screen.getByRole("button", { name: "Repetir el fragmento" }));
    await user.click(screen.getByRole("button", { name: "Quitar el fragmento" }));

    expect(screen.queryByText("Fragmento: de 0:02 a 0:06")).toBeNull();

    audio.currentTime = 10;
    fireEvent.timeUpdate(audio);
    expect(audio.currentTime).toBe(10);
  });
});

describe("nextTimeForLoop", () => {
  it("sin fragmento completo no manda saltar a ningún sitio", () => {
    expect(nextTimeForLoop(9, null, null)).toBeNull();
    expect(nextTimeForLoop(9, 5, null)).toBeNull();
    expect(nextTimeForLoop(9, null, 8)).toBeNull();
    // Un fragmento invertido o vacío no es un fragmento.
    expect(nextTimeForLoop(9, 8, 8)).toBeNull();
    expect(nextTimeForLoop(9, 8, 5)).toBeNull();
  });

  it("dentro del fragmento deja seguir; fuera, vuelve al inicio", () => {
    expect(nextTimeForLoop(6, 5, 9)).toBeNull();
    expect(nextTimeForLoop(9, 5, 9)).toBe(5);
    expect(nextTimeForLoop(11, 5, 9)).toBe(5);
    // Rebobinar por debajo del inicio también devuelve al fragmento.
    expect(nextTimeForLoop(2, 5, 9)).toBe(5);
  });
});

describe("formatPlaybackTime", () => {
  it("segundos a «m:ss», sin negativos ni valores imposibles", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(9.7)).toBe("0:09");
    expect(formatPlaybackTime(75)).toBe("1:15");
    expect(formatPlaybackTime(-3)).toBe("0:00");
    expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
  });
});
