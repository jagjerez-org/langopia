import { describe, expect, it } from "vitest";
import { InvalidExerciseError, validateExercise } from "./exercise-schemas.js";

/**
 * Un caso válido y al menos un inválido por cada uno de los once tipos.
 *
 * Los casos válidos son, deliberadamente, el contenido real del seed (o una
 * variación mínima de él): si el esquema rechazara lo que ya está sembrado en
 * la base de datos, la interfaz no podría ni mostrar los ejercicios que ya
 * existen.
 *
 * Los casos inválidos no se quedan en «falta un campo»: cada tipo trae
 * además el error que solo aparece si nadie comprueba la COHERENCIA entre
 * `prompt` y `solution` (un índice fuera de rango, una permutación que no lo
 * es, un hueco sin su marcador, una secuencia del tamaño equivocado...). Un
 * esquema que solo mira la forma dejaría pasar todos estos.
 */
describe("validateExercise", () => {
  describe("cloze", () => {
    const validPrompt = {
      text: "Me duele la garganta {{1}} hace tres días y no puedo {{2}} bien.",
      blanks: [
        { id: 1, hint: "preposición temporal" },
        { id: 2, hint: "verbo, infinitivo" },
      ],
      openEnded: true,
    };
    const validSolution = { 1: ["desde"], 2: ["tragar"] };

    it("acepta un hueco abierto con una respuesta por hueco (seed real)", () => {
      expect(() => validateExercise("cloze", validPrompt, validSolution)).not.toThrow();
    });

    it("rechaza un hueco cerrado (openEnded: false) sin opciones", () => {
      const prompt = { ...validPrompt, openEnded: false };
      expect(() => validateExercise("cloze", prompt, validSolution)).toThrow(InvalidExerciseError);
    });

    it("rechaza un hueco abierto que además trae opciones", () => {
      const prompt = { ...validPrompt, options: ["desde", "hace"] };
      expect(() => validateExercise("cloze", prompt, validSolution)).toThrow(InvalidExerciseError);
    });

    it("rechaza una solución sin entrada para uno de los huecos", () => {
      const solution = { 1: ["desde"] };
      expect(() => validateExercise("cloze", validPrompt, solution)).toThrow(InvalidExerciseError);
    });

    it("rechaza un hueco cuyo id no aparece marcado en el texto", () => {
      const prompt = {
        ...validPrompt,
        blanks: [...validPrompt.blanks, { id: 3, hint: "no existe en el texto" }],
      };
      const solution = { ...validSolution, 3: ["nada"] };
      expect(() => validateExercise("cloze", prompt, solution)).toThrow(InvalidExerciseError);
    });
  });

  describe("multiple_choice", () => {
    const validPrompt = {
      question: "Ich gehe ___ Supermarkt.",
      options: ["in den", "in dem", "im", "zu der"],
    };

    it("acepta preguntas con 2 a 6 opciones y un índice correcto en rango (seed real)", () => {
      expect(() => validateExercise("multiple_choice", validPrompt, { correct: 0 })).not.toThrow();
    });

    it("rechaza un `correct` fuera del rango de `options`", () => {
      expect(() => validateExercise("multiple_choice", validPrompt, { correct: 4 })).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza menos de 2 opciones", () => {
      const prompt = { question: "¿?", options: ["única"] };
      expect(() => validateExercise("multiple_choice", prompt, { correct: 0 })).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza más de 6 opciones", () => {
      const prompt = { question: "¿?", options: ["a", "b", "c", "d", "e", "f", "g"] };
      expect(() => validateExercise("multiple_choice", prompt, { correct: 0 })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("matching", () => {
    const validPrompt = {
      left: ["la receta", "el mostrador", "la sala de espera", "el justificante"],
      right: [
        "documento para el trabajo",
        "papel con el medicamento",
        "donde se pide cita",
        "donde esperas tu turno",
      ],
    };
    const validSolution = {
      pairs: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ],
    };

    it("acepta left/right del mismo tamaño y pairs sin índices repetidos (seed real)", () => {
      expect(() => validateExercise("matching", validPrompt, validSolution)).not.toThrow();
    });

    it("rechaza left y right de distinto tamaño", () => {
      const prompt = { left: validPrompt.left, right: validPrompt.right.slice(0, 2) };
      expect(() => validateExercise("matching", prompt, validSolution)).toThrow(InvalidExerciseError);
    });

    it("rechaza pairs que repite un índice de left", () => {
      const solution = {
        pairs: [
          [0, 1],
          [0, 2],
          [2, 3],
          [3, 0],
        ],
      };
      expect(() => validateExercise("matching", validPrompt, solution)).toThrow(InvalidExerciseError);
    });

    it("rechaza pairs con un índice fuera de rango", () => {
      const solution = {
        pairs: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 9],
        ],
      };
      expect(() => validateExercise("matching", validPrompt, solution)).toThrow(InvalidExerciseError);
    });
  });

  describe("ordering", () => {
    const validPrompt = { tokens: ["heute", "ich", "einkaufen", "gehe", "Nachmittag", "am"] };
    const validSolution = { order: [1, 3, 0, 5, 4, 2] };

    it("acepta tokens (3-12) con order como permutación exacta (seed real)", () => {
      expect(() => validateExercise("ordering", validPrompt, validSolution)).not.toThrow();
    });

    it("rechaza un order con un índice repetido y otro ausente", () => {
      const solution = { order: [1, 1, 0, 5, 4, 2] };
      expect(() => validateExercise("ordering", validPrompt, solution)).toThrow(InvalidExerciseError);
    });

    it("rechaza menos de 3 tokens", () => {
      const prompt = { tokens: ["uno", "dos"] };
      expect(() => validateExercise("ordering", prompt, { order: [0, 1] })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("minimal_pairs", () => {
    const validPrompt = {
      pairs: [
        { a: "pero", b: "perro", contrast: "vibrante simple vs. múltiple" },
        { a: "caro", b: "carro", contrast: "vibrante simple vs. múltiple" },
        { a: "coro", b: "corro", contrast: "vibrante simple vs. múltiple" },
      ],
      question: "¿Qué palabra oyes?",
    };
    const validSolution = { sequence: ["b", "a", "b"] };

    it("acepta pares mínimos con una respuesta a/b por contraste (seed real)", () => {
      expect(() => validateExercise("minimal_pairs", validPrompt, validSolution)).not.toThrow();
    });

    it("rechaza un valor de sequence que no es «a» ni «b»", () => {
      const solution = { sequence: ["b", "a", "c"] };
      expect(() => validateExercise("minimal_pairs", validPrompt, solution)).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza una sequence de tamaño distinto al número de contrastes", () => {
      const solution = { sequence: ["b", "a"] };
      expect(() => validateExercise("minimal_pairs", validPrompt, solution)).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("dictation", () => {
    const validPrompt = { audioRef: "unit-audio", segments: 4, question: "Schreib, was du hörst." };
    const validSolution = {
      segments: [
        "Ich hätte gern ein Kilo Äpfel.",
        "Wo finde ich die Milch?",
        "Das macht zusammen zwölf Euro.",
        "Brauchen Sie eine Tüte?",
      ],
    };

    it("acepta tantos textos como segmentos (seed real)", () => {
      expect(() => validateExercise("dictation", validPrompt, validSolution)).not.toThrow();
    });

    it("rechaza menos textos que segmentos declarados", () => {
      const solution = { segments: validSolution.segments.slice(0, 2) };
      expect(() => validateExercise("dictation", validPrompt, solution)).toThrow(InvalidExerciseError);
    });

    it("rechaza un número de segmentos que no es positivo", () => {
      const prompt = { ...validPrompt, segments: 0 };
      expect(() => validateExercise("dictation", prompt, { segments: [] })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("shadowing", () => {
    const validPrompt = {
      audioRef: "unit-audio",
      target: "Entschuldigung, wo finde ich die Milchprodukte?",
      maxDelayMs: 800,
    };

    it("acepta audioRef, target y maxDelayMs sin solution (seed real)", () => {
      expect(() => validateExercise("shadowing", validPrompt, undefined)).not.toThrow();
    });

    it("rechaza una solution cuando el tipo se autoevalúa por repetición", () => {
      expect(() => validateExercise("shadowing", validPrompt, {})).toThrow(InvalidExerciseError);
    });

    it("rechaza maxDelayMs ausente", () => {
      const { maxDelayMs: _maxDelayMs, ...prompt } = validPrompt;
      expect(() => validateExercise("shadowing", prompt, undefined)).toThrow(InvalidExerciseError);
    });
  });

  describe("listening_comprehension", () => {
    const validPrompt = {
      audioRef: "unit-audio",
      question: "¿Desde cuándo tiene fiebre el paciente?",
      options: ["Desde ayer", "Desde hace tres días", "Desde la semana pasada"],
      playbackRate: 0.92,
    };

    it("acepta audioRef, question, options y correct en rango (seed real, con campo extra)", () => {
      expect(() => validateExercise("listening_comprehension", validPrompt, { correct: 1 })).not.toThrow();
    });

    it("rechaza correct fuera de rango", () => {
      expect(() => validateExercise("listening_comprehension", validPrompt, { correct: 3 })).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza menos de 2 opciones", () => {
      const prompt = { audioRef: "unit-audio", question: "¿?", options: ["única"] };
      expect(() => validateExercise("listening_comprehension", prompt, { correct: 0 })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("reading_comprehension", () => {
    const validPrompt = {
      passage:
        "Following our call on Tuesday, I am writing to confirm that the delivery date has been " +
        "moved to 14 September. We appreciate that this is later than originally agreed, and we are " +
        "happy to absorb the additional storage costs.",
      question: "What is the sender offering to compensate for the delay?",
      options: [
        "A discount on the next order",
        "To cover the extra storage costs",
        "An earlier partial delivery",
      ],
    };

    it("acepta un pasaje real con correct en rango (seed real)", () => {
      expect(() => validateExercise("reading_comprehension", validPrompt, { correct: 1 })).not.toThrow();
    });

    it("rechaza correct fuera de rango", () => {
      expect(() => validateExercise("reading_comprehension", validPrompt, { correct: 9 })).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza un pasaje vacío o demasiado corto para ser un texto que leer", () => {
      const prompt = { ...validPrompt, passage: "Hi." };
      expect(() => validateExercise("reading_comprehension", prompt, { correct: 1 })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("written_production", () => {
    const validPrompt = {
      task: "Escribe un correo a tu médico de cabecera pidiendo cita.",
      minWords: 80,
      maxWords: 100,
      register: "formal",
      mustInclude: ["saludo formal", "motivo de la consulta", "disponibilidad horaria"],
    };

    it("acepta task, minWords < maxWords y register, sin solution (seed real)", () => {
      expect(() => validateExercise("written_production", validPrompt, undefined)).not.toThrow();
    });

    it("rechaza minWords mayor o igual que maxWords", () => {
      const prompt = { ...validPrompt, minWords: 100, maxWords: 100 };
      expect(() => validateExercise("written_production", prompt, undefined)).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza una solution: este tipo se corrige con rúbrica, no con clave automática", () => {
      expect(() => validateExercise("written_production", validPrompt, { correct: 0 })).toThrow(
        InvalidExerciseError,
      );
    });
  });

  describe("spoken_production", () => {
    const validPrompt = {
      task: "Explica a la recepcionista qué te pasa y pide cita para esta semana.",
      durationSeconds: 90,
      prompts: ["síntomas", "desde cuándo", "preferencia de horario"],
    };

    it("acepta task y durationSeconds, sin solution (seed real)", () => {
      expect(() => validateExercise("spoken_production", validPrompt, undefined)).not.toThrow();
    });

    it("rechaza durationSeconds que no es positivo", () => {
      const prompt = { ...validPrompt, durationSeconds: 0 };
      expect(() => validateExercise("spoken_production", prompt, undefined)).toThrow(
        InvalidExerciseError,
      );
    });

    it("rechaza una solution: este tipo también se corrige con rúbrica", () => {
      expect(() => validateExercise("spoken_production", validPrompt, {})).toThrow(InvalidExerciseError);
    });
  });

  it("rechaza un tipo de ejercicio desconocido", () => {
    // @ts-expect-error -- se prueba justo el caso de un tipo que no existe
    expect(() => validateExercise("blank_page", {}, {})).toThrow(InvalidExerciseError);
  });
});
