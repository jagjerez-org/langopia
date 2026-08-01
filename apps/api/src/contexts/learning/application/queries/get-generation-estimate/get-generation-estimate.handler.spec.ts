import { describe, expect, it } from "vitest";
import type { GenerationEstimate, LearningReadModel } from "../../ports/learning-read-model.port.js";
import { GetGenerationEstimateHandler, GetGenerationEstimateQuery } from "./get-generation-estimate.handler.js";

function fakeReadModel(estimate: GenerationEstimate): LearningReadModel {
  return {
    listUnits: async () => {
      throw new Error("no usado en esta prueba");
    },
    listPublishTargets: async () => {
      throw new Error("no usado en esta prueba");
    },
    getUnitDetail: async () => {
      throw new Error("no usado en esta prueba");
    },
    getGenerationEstimate: async () => estimate,
  };
}

describe("GetGenerationEstimateHandler", () => {
  it("pasa el resultado del modelo de lectura tal cual, sin recalcular nada", async () => {
    const estimate: GenerationEstimate = {
      estimatedCredits: 40,
      currentBalance: 120,
      hardLimit: true,
      wouldBeRejected: false,
      unavailableExerciseTypes: ["dictation", "shadowing", "listening_comprehension"],
    };
    const handler = new GetGenerationEstimateHandler(fakeReadModel(estimate));

    const result = await handler.execute();

    expect(result).toEqual(estimate);
  });

  it("refleja el rechazo cuando el saldo no llega a la reserva estimada, ya decidido por el modelo de lectura", async () => {
    const estimate: GenerationEstimate = {
      estimatedCredits: 40,
      currentBalance: 5,
      hardLimit: true,
      wouldBeRejected: true,
      unavailableExerciseTypes: ["dictation", "shadowing", "listening_comprehension"],
    };
    const handler = new GetGenerationEstimateHandler(fakeReadModel(estimate));

    const result = await handler.execute(new GetGenerationEstimateQuery());

    expect(result.wouldBeRejected).toBe(true);
  });
});
