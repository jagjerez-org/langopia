import { describe, expect, it, vi } from "vitest";
import type { SchoolRepositoryPort } from "../../../domain/ports/school-repository.port.js";
import { CheckSlugAvailabilityHandler, CheckSlugAvailabilityQuery } from "./check-slug-availability.handler.js";

function fakeSchools(taken: boolean): SchoolRepositoryPort & { existsBySlug: ReturnType<typeof vi.fn> } {
  return {
    save: async () => undefined,
    existsBySlug: vi.fn(async () => taken),
    findCurrent: async () => null,
    updateSettings: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
}

describe("CheckSlugAvailabilityHandler", () => {
  it("un slug con formato inválido es 'no disponible' sin preguntar a la base de datos", async () => {
    const schools = fakeSchools(false);
    const handler = new CheckSlugAvailabilityHandler(schools);

    const result = await handler.execute(new CheckSlugAvailabilityQuery("ab"));

    expect(result).toEqual({ available: false });
    expect(schools.existsBySlug).not.toHaveBeenCalled();
  });

  it("un slug con formato válido y libre está disponible", async () => {
    const schools = fakeSchools(false);
    const handler = new CheckSlugAvailabilityHandler(schools);

    const result = await handler.execute(new CheckSlugAvailabilityQuery("academia-nueva"));

    expect(result).toEqual({ available: true });
    expect(schools.existsBySlug).toHaveBeenCalledWith("academia-nueva");
  });

  it("un slug con formato válido pero ya en uso no está disponible", async () => {
    const schools = fakeSchools(true);
    const handler = new CheckSlugAvailabilityHandler(schools);

    const result = await handler.execute(new CheckSlugAvailabilityQuery("nordwind"));

    expect(result).toEqual({ available: false });
  });

  it("una palabra reservada tampoco está disponible", async () => {
    const schools = fakeSchools(false);
    const handler = new CheckSlugAvailabilityHandler(schools);

    const result = await handler.execute(new CheckSlugAvailabilityQuery("admin"));

    expect(result).toEqual({ available: false });
    expect(schools.existsBySlug).not.toHaveBeenCalled();
  });
});
