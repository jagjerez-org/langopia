import { useState } from "react";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseResponse } from "../types.js";
import { ExerciseInput } from "./ExerciseInput.js";

/**
 * Los once tipos de ejercicio (Paso 1 del brief), cada uno con su interacción
 * real y, sobre todo, con la `response` que la API espera de verdad.
 *
 * La forma de cada `response` no es una convención de este panel: es lo que
 * compara `scoreAutomatically` (`assessment/domain/model/automatic-grading.ts`)
 * clave a clave contra la `solution` que valida `exercise-schemas.ts`. Los
 * `prompt` de estas pruebas están copiados de los que sirve la API contra el
 * seed, no inventados.
 */

/**
 * Anfitrión con estado: los once componentes son CONTROLADOS (reciben `value`
 * y emiten `onChange`), así que sin alguien que guarde lo emitido y se lo
 * devuelva, escribir cinco letras seguidas dejaría solo la última.
 */
function Host({
  type,
  prompt,
  onChange,
}: {
  type: string;
  prompt: Record<string, unknown>;
  onChange: (response: ExerciseResponse) => void;
}): ReactElement {
  const [value, setValue] = useState<ExerciseResponse | undefined>(undefined);
  return (
    <ExerciseInput
      type={type}
      prompt={prompt}
      value={value}
      onChange={(response) => {
        setValue(response);
        onChange(response);
      }}
      fieldPrefix="ex-1"
    />
  );
}

function renderInput(type: string, prompt: Record<string, unknown>) {
  const onChange = vi.fn<(response: ExerciseResponse) => void>();
  render(<Host type={type} prompt={prompt} onChange={onChange} />);
  return {
    onChange,
    lastResponse: (): ExerciseResponse | undefined => onChange.mock.calls.at(-1)?.[0],
  };
}

describe("los once tipos de ejercicio producen la respuesta que espera la API", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("cloze abierto: una entrada por hueco, con el id del hueco como clave", async () => {
    const { lastResponse } = renderInput("cloze", {
      text: "Me duele la garganta {{1}} hace tres días y no puedo {{2}} bien.",
      blanks: [
        { id: 1, hint: "preposición temporal" },
        { id: 2, hint: "verbo, infinitivo" },
      ],
      openEnded: true,
    });

    // El marcador crudo no se le enseña al alumno; el número del hueco, sí.
    screen.getByText(/Me duele la garganta \(1\) hace tres días y no puedo \(2\) bien\./);

    await user.type(screen.getByLabelText("Hueco (1)"), "desde");
    await user.type(screen.getByLabelText("Hueco (2)"), "tragar");

    expect(lastResponse()).toEqual({ "1": "desde", "2": "tragar" });
  });

  it("cloze cerrado: el hueco se elige entre las opciones del enunciado", async () => {
    const { lastResponse } = renderInput("cloze", {
      text: "Ich gehe {{1}} Supermarkt.",
      blanks: [{ id: 1 }],
      openEnded: false,
      options: ["in den", "im"],
    });

    await user.selectOptions(screen.getByLabelText("Hueco (1)"), "in den");

    expect(lastResponse()).toEqual({ "1": "in den" });
  });

  it("multiple_choice: `{ correct: índice }`, igual que `solution.correct`", async () => {
    const { lastResponse } = renderInput("multiple_choice", {
      question: "Ich gehe ___ Supermarkt.",
      options: ["in den", "in dem", "im", "zu der"],
    });

    await user.click(screen.getByLabelText("im"));

    expect(lastResponse()).toEqual({ correct: 2 });
  });

  it("matching: pares en orden de `left`, y `-1` para lo que queda sin emparejar", async () => {
    const { lastResponse } = renderInput("matching", {
      left: ["la receta", "el mostrador"],
      right: ["donde se pide cita", "papel con el medicamento"],
    });

    await user.selectOptions(screen.getByLabelText("la receta"), "1");

    // Con un solo par elegido, el otro NO desaparece: correrlo desalinearía la
    // comparación posición a posición que hace `scoreAutomatically`.
    expect(lastResponse()).toEqual({ pairs: [[0, 1], [1, -1]] });

    await user.selectOptions(screen.getByLabelText("el mostrador"), "0");

    expect(lastResponse()).toEqual({ pairs: [[0, 1], [1, 0]] });
  });

  it("ordering: `{ order }` con los índices originales en el orden elegido", async () => {
    const { lastResponse } = renderInput("ordering", {
      tokens: ["heute", "ich", "einkaufen"],
      target: "Wortstellung im Aussagesatz",
    });

    await user.click(screen.getByRole("button", { name: "Subir «ich»" }));

    expect(lastResponse()).toEqual({ order: [1, 0, 2] });
  });

  it("ordering: la primera palabra no se puede subir ni la última bajar", () => {
    renderInput("ordering", { tokens: ["heute", "ich", "einkaufen"] });

    expect((screen.getByRole("button", { name: "Subir «heute»" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Bajar «einkaufen»" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("minimal_pairs: `{ sequence }` con una entrada por contraste, en su orden", async () => {
    const { lastResponse } = renderInput("minimal_pairs", {
      question: "¿Qué palabra oyes?",
      pairs: [
        { a: "pero", b: "perro", contrast: "vibrante simple vs. múltiple" },
        { a: "caro", b: "carro", contrast: "vibrante simple vs. múltiple" },
      ],
    });

    await user.click(screen.getByLabelText("perro"));
    // El contraste sin responder viaja como vacío en su posición, no se omite.
    expect(lastResponse()).toEqual({ sequence: ["b", ""] });

    await user.click(screen.getByLabelText("caro"));

    expect(lastResponse()).toEqual({ sequence: ["b", "a"] });
  });

  it("dictation: `{ segments }` con tantos textos como segmentos declara el enunciado", async () => {
    const { lastResponse } = renderInput("dictation", {
      audioRef: "unit-audio",
      question: "Schreib, was du hörst.",
      segments: 2,
    });

    await user.type(screen.getByLabelText("Segmento 1"), "Wo ist die Milch?");
    await user.type(screen.getByLabelText("Segmento 2"), "Zwölf Euro.");

    expect(lastResponse()).toEqual({ segments: ["Wo ist die Milch?", "Zwölf Euro."] });
  });

  it("dictation: sin URL reproducible, el reproductor dice que el audio no está disponible", () => {
    renderInput("dictation", { audioRef: "unit-audio", segments: 1 });

    screen.getByText("El audio de este ejercicio no está disponible todavía.");
  });

  it("shadowing: `{ completed: true }` — no hay solución que comparar ni grabación que subir", async () => {
    const { lastResponse } = renderInput("shadowing", {
      audioRef: "unit-audio",
      target: "Entschuldigung, wo finde ich die Milchprodukte?",
      maxDelayMs: 800,
    });

    screen.getByText("Entschuldigung, wo finde ich die Milchprodukte?");
    screen.getByText("Retraso máximo: 800 ms");

    await user.click(screen.getByLabelText("Ya lo he repetido"));

    expect(lastResponse()).toEqual({ completed: true });
  });

  it("listening_comprehension: `{ correct: índice }`, con su reproductor", async () => {
    const { lastResponse } = renderInput("listening_comprehension", {
      audioRef: "unit-audio",
      question: "¿Desde cuándo tiene fiebre el paciente?",
      options: ["Desde ayer", "Desde hace tres días", "Desde la semana pasada"],
      playbackRate: 0.92,
    });

    screen.getByText("El audio de este ejercicio no está disponible todavía.");
    await user.click(screen.getByLabelText("Desde hace tres días"));

    expect(lastResponse()).toEqual({ correct: 1 });
  });

  it("reading_comprehension: el pasaje se lee y la respuesta es `{ correct: índice }`", async () => {
    const { lastResponse } = renderInput("reading_comprehension", {
      passage: "Following our call on Tuesday, I am writing to confirm the new delivery date.",
      question: "What is the sender confirming?",
      options: ["A discount", "The new delivery date"],
    });

    screen.getByText("Following our call on Tuesday, I am writing to confirm the new delivery date.");
    await user.click(screen.getByLabelText("The new delivery date"));

    expect(lastResponse()).toEqual({ correct: 1 });
  });

  it("written_production: `{ text, wordCount }`, y la extensión se enseña sin bloquear el envío", async () => {
    const { lastResponse } = renderInput("written_production", {
      task: "Escribe un correo a tu médico de cabecera pidiendo cita.",
      minWords: 80,
      maxWords: 100,
      register: "formal",
      mustInclude: ["saludo formal"],
    });

    screen.getByText("Entre 80 y 100 palabras");
    screen.getByText("Registro: formal");
    screen.getByText("saludo formal");

    await user.type(screen.getByLabelText("Tu texto"), "Estimado doctor");

    expect(lastResponse()).toEqual({ text: "Estimado doctor", wordCount: 2 });
  });

  it("spoken_production: sin grabación, se manda la transcripción como `{ text, wordCount }`", async () => {
    const { lastResponse } = renderInput("spoken_production", {
      task: "Explica a la recepcionista qué te pasa y pide cita.",
      durationSeconds: 90,
      prompts: ["síntomas"],
    });

    screen.getByText("Duración prevista: 90 segundos");
    screen.getByText(
      "Todavía no se puede grabar desde el panel: escribe aquí lo que has dicho para que tu profesor lo corrija.",
    );

    await user.type(screen.getByLabelText("Lo que has dicho"), "Buenos días");

    expect(lastResponse()).toEqual({ text: "Buenos días", wordCount: 2 });
  });

  it("un tipo que este panel no sabe pintar lo dice, no enseña el JSON crudo", () => {
    renderInput("telepathy", { question: "¿?" });

    screen.getByText("Este tipo de ejercicio todavía no se puede hacer desde el panel.");
    expect(screen.queryByText(/\{/)).toBeNull();
  });
});
