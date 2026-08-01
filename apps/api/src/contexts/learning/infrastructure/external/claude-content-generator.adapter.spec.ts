import type Anthropic from "@anthropic-ai/sdk";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import {
  ClaudeContentGeneratorAdapter,
  ContentGenerationFailedError,
  MissingAnthropicApiKeyError,
} from "./claude-content-generator.adapter.js";

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** Forma mínima de lo que el adaptador lee de una respuesta de `messages.parse`. */
function fakeResponse<T>(
  parsedOutput: T | null,
  usage: { input_tokens: number; output_tokens: number } = { input_tokens: 100, output_tokens: 50 },
  stopReason: string = "end_turn",
) {
  return { usage, stop_reason: stopReason, parsed_output: parsedOutput };
}

/** Expone `createClient` para sustituirlo por un doble del SDK en cada prueba. */
class TestableClaudeContentGeneratorAdapter extends ClaudeContentGeneratorAdapter {
  createClientCalls = 0;
  parseImpl: (params: unknown) => Promise<unknown> = () => {
    throw new Error("no configurado en esta prueba");
  };

  protected override createClient(): Anthropic {
    this.createClientCalls += 1;
    return { messages: { parse: (params: unknown) => this.parseImpl(params) } } as unknown as Anthropic;
  }
}

const B1_MEDICO_PARAMS = {
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  skills: ["listening", "speaking"],
  locale: "es-ES",
};

describe("ClaudeContentGeneratorAdapter", () => {
  it("sin ANTHROPIC_API_KEY, rechaza con MissingAnthropicApiKeyError sin llegar a crear ningún cliente (paso 3: falla limpio sin clave)", async () => {
    const adapter = new TestableClaudeContentGeneratorAdapter(configWith({ ANTHROPIC_API_KEY: undefined }));

    await expect(adapter.generateUnit(B1_MEDICO_PARAMS)).rejects.toBeInstanceOf(MissingAnthropicApiKeyError);
    expect(adapter.createClientCalls).toBe(0);
  });

  it("con salida válida en el primer intento, devuelve el contenido y el coste calculado con la tarifa del modelo, sin reintentar", async () => {
    const adapter = new TestableClaudeContentGeneratorAdapter(configWith({ ANTHROPIC_API_KEY: "sk-ant-test" }));
    let calls = 0;
    adapter.parseImpl = async () => {
      calls += 1;
      return fakeResponse(
        {
          title: "En la consulta del médico",
          description: "Vocabulario y expresiones para una cita médica.",
          body: "El paciente entra en la consulta y saluda al médico...",
        },
        { input_tokens: 100_000, output_tokens: 20_000 },
      );
    };

    const result = await adapter.generateUnit(B1_MEDICO_PARAMS);

    expect(calls).toBe(1);
    expect(result.title).toBe("En la consulta del médico");
    expect(result.body.length).toBeGreaterThan(0);
    // 100_000 tokens de entrada a $5/millón + 20_000 de salida a $25/millón = 100 céntimos.
    expect(result.cost).toEqual({
      inputTokens: 100_000,
      outputTokens: 20_000,
      costCents: 100,
      model: "claude-opus-5",
    });
  });

  it("con una salida inválida (un `correct` fuera de rango), reintenta una vez con el error como contexto y termina en verde", async () => {
    const adapter = new TestableClaudeContentGeneratorAdapter(configWith({ ANTHROPIC_API_KEY: "sk-ant-test" }));
    const invalidExercise = {
      type: "multiple_choice",
      prompt: { question: "¿Qué hora es?", options: ["Las tres", "Las cuatro"] },
      solution: { correct: 5 },
    };
    const validExercise = {
      type: "multiple_choice",
      prompt: { question: "¿Qué hora es?", options: ["Las tres", "Las cuatro"] },
      solution: { correct: 0 },
    };

    const seenUserPrompts: string[] = [];
    let calls = 0;
    adapter.parseImpl = async (params) => {
      calls += 1;
      seenUserPrompts.push((params as { messages: Array<{ content: string }> }).messages[0]!.content);
      if (calls === 1) {
        return fakeResponse({ exercises: [invalidExercise] }, { input_tokens: 1000, output_tokens: 200 });
      }
      return fakeResponse({ exercises: [validExercise] }, { input_tokens: 1200, output_tokens: 250 });
    };

    const result = await adapter.generateExercises({
      unitBody: "El paciente entra en la consulta...",
      language: "es",
      level: "B1",
      types: ["multiple_choice"],
      count: 1,
    });

    expect(calls).toBe(2);
    expect(result.exercises).toEqual([validExercise]);
    // El coste acumula LOS DOS intentos: el proveedor cobró ambas llamadas, no solo la que valida.
    expect(result.cost).toEqual({
      inputTokens: 2200,
      outputTokens: 450,
      costCents: Math.round(((2200 / 1_000_000) * 5 + (450 / 1_000_000) * 25) * 100),
      model: "claude-opus-5",
    });
    // El segundo intento lleva el error de validación del primero como contexto.
    expect(seenUserPrompts[1]).toContain("correct");
    expect(seenUserPrompts[1]).toContain("fuera de rango");
    expect(seenUserPrompts[1]).toContain(JSON.stringify(invalidExercise.solution.correct));
  });

  it("si dos intentos seguidos fallan la validación, lanza ContentGenerationFailedError con el coste acumulado y no intenta una tercera vez", async () => {
    const adapter = new TestableClaudeContentGeneratorAdapter(configWith({ ANTHROPIC_API_KEY: "sk-ant-test" }));
    const invalidExercise = {
      type: "multiple_choice",
      prompt: { question: "¿?", options: ["a", "b"] },
      solution: { correct: 9 },
    };

    let calls = 0;
    adapter.parseImpl = async () => {
      calls += 1;
      return fakeResponse({ exercises: [invalidExercise] }, { input_tokens: 500, output_tokens: 100 });
    };

    const promise = adapter.generateExercises({
      unitBody: "...",
      language: "es",
      level: "B1",
      types: ["multiple_choice"],
      count: 1,
    });

    await expect(promise).rejects.toBeInstanceOf(ContentGenerationFailedError);
    expect(calls).toBe(2);

    const error = (await promise.catch((e: unknown) => e)) as ContentGenerationFailedError;
    // El coste de los DOS intentos fallidos viaja en el error: el proveedor cobró y no hay
    // ejercicio válido, pero sin este dato no se podría registrar el gasto real en `ai_generations`.
    expect(error.cost).toEqual({
      inputTokens: 1000,
      outputTokens: 200,
      costCents: Math.round(((1000 / 1_000_000) * 5 + (200 / 1_000_000) * 25) * 100),
      model: "claude-opus-5",
    });
  });

  it("correctWriting: si `byCriterion` no trae las mismas claves que la rúbrica, reintenta con el error como contexto", async () => {
    const adapter = new TestableClaudeContentGeneratorAdapter(configWith({ ANTHROPIC_API_KEY: "sk-ant-test" }));
    const rubric = {
      criteria: [
        { key: "gramatica", label: "Gramática", descriptors: ["Uso correcto de los tiempos verbales"] },
        { key: "vocabulario", label: "Vocabulario", descriptors: ["Variedad léxica"] },
      ],
    };

    let calls = 0;
    adapter.parseImpl = async () => {
      calls += 1;
      if (calls === 1) {
        // Falta "vocabulario" y sobra "cohesion": no son las claves de la rúbrica pedida.
        return fakeResponse(
          { score: 70, feedback: "Bien en general.", byCriterion: { gramatica: 70, cohesion: 60 } },
          { input_tokens: 300, output_tokens: 80 },
        );
      }
      return fakeResponse(
        { score: 70, feedback: "Bien en general.", byCriterion: { gramatica: 70, vocabulario: 65 } },
        { input_tokens: 320, output_tokens: 90 },
      );
    };

    const result = await adapter.correctWriting({
      task: "Escribe un correo pidiendo cita.",
      response: "Querido doctor, quisiera pedir una cita...",
      rubric,
      language: "es",
      level: "B1",
    });

    expect(calls).toBe(2);
    expect(result.byCriterion).toEqual({ gramatica: 70, vocabulario: 65 });
    expect(result.cost.inputTokens).toBe(620);
    expect(result.cost.outputTokens).toBe(170);
  });
});

/**
 * Paso 5 del brief: prueba de integración real contra la API, generando una
 * unidad B1 de español. Se salta en este entorno porque no hay
 * `ANTHROPIC_API_KEY` configurada (ver el informe de la tarea); en cuanto
 * exista una clave real, esta prueba se activa sola.
 */
describe.skipIf(!process.env.ANTHROPIC_API_KEY)(
  "ClaudeContentGeneratorAdapter — integración real (requiere ANTHROPIC_API_KEY)",
  () => {
    it("genera una unidad B1 de español con contenido real del proveedor", async () => {
      const adapter = new ClaudeContentGeneratorAdapter(
        configWith({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
      );

      const result = await adapter.generateUnit(B1_MEDICO_PARAMS);

      expect(result.title.length).toBeGreaterThan(0);
      expect(result.description.length).toBeGreaterThan(0);
      expect(result.body.length).toBeGreaterThan(0);
      expect(result.cost.costCents).toBeGreaterThan(0);
      expect(result.cost.model).toBe("claude-opus-5");
    }, 60_000);
  },
);
