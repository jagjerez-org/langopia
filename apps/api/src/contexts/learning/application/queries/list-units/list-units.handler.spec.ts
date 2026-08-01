import { describe, expect, it } from "vitest";
import type { ContentUnitListItem, LearningReadModel } from "../../ports/learning-read-model.port.js";
import { ListUnitsHandler, ListUnitsQuery } from "./list-units.handler.js";

const UNIDAD: ContentUnitListItem = {
  contentUnitId: "11111111-1111-4111-8111-111111111111",
  code: "ES-B1-U07",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  status: "in_review",
  source: "ai_generated",
  creditsSpent: 23,
  createdAt: "2026-07-27T10:00:00.000Z",
  title: "En la consulta del médico",
};

function fakeReadModel(units: ContentUnitListItem[]): LearningReadModel {
  return {
    listUnits: async (filter) => units.filter((u) => !filter.status || u.status === filter.status),
    listPublishTargets: async () => {
      throw new Error("no debería llamarse en este doble");
    },
    getUnitDetail: async () => {
      throw new Error("no usado en esta prueba");
    },
    getGenerationEstimate: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
}

describe("ListUnitsHandler", () => {
  it("devuelve las unidades del modelo de lectura", async () => {
    const handler = new ListUnitsHandler(fakeReadModel([UNIDAD]));

    const result = await handler.execute(new ListUnitsQuery({}));

    expect(result).toEqual([UNIDAD]);
  });

  it("pasa el filtro de estado al modelo de lectura, sin decidirlo aquí", async () => {
    const publicada = { ...UNIDAD, contentUnitId: "22222222-2222-4222-8222-222222222222", status: "published" };
    const handler = new ListUnitsHandler(fakeReadModel([UNIDAD, publicada]));

    const result = await handler.execute(new ListUnitsQuery({ status: "published" }));

    expect(result).toEqual([publicada]);
  });
});
