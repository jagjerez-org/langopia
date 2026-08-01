import { describe, expect, it } from "vitest";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { SchoolRepositoryPort, SchoolSettings } from "../../../domain/ports/school-repository.port.js";
import { GetSchoolSettingsHandler, GetSchoolSettingsQuery } from "./get-school-settings.handler.js";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeSchools(settings: SchoolSettings | null): SchoolRepositoryPort {
  return {
    save: async () => undefined,
    existsBySlug: async () => false,
    findCurrent: async () => settings,
    updateSettings: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
}

describe("GetSchoolSettingsHandler", () => {
  it("serializa la fecha de fin de prueba a ISO 8601", async () => {
    const handler = new GetSchoolSettingsHandler(
      fakeSchools({
        name: "Academia Nueva",
        defaultLocale: "es-ES",
        supportedLocales: ["es-ES"],
        status: "trial",
        trialEndsAt: new Date("2026-08-10T00:00:00Z"),
      }),
      fakeUow(),
    );

    const result = await handler.execute();

    expect(result).toEqual({
      name: "Academia Nueva",
      defaultLocale: "es-ES",
      supportedLocales: ["es-ES"],
      status: "trial",
      trialEndsAt: "2026-08-10T00:00:00.000Z",
    });
  });

  it("sin fecha de fin de prueba, devuelve null en vez de una cadena vacía", async () => {
    const handler = new GetSchoolSettingsHandler(
      fakeSchools({
        name: "Academia Nueva",
        defaultLocale: "es-ES",
        supportedLocales: ["es-ES"],
        status: "active",
        trialEndsAt: null,
      }),
      fakeUow(),
    );

    const result = await handler.execute();

    expect(result.trialEndsAt).toBeNull();
  });

  it("lanza si la escuela activa no existe (no debería ocurrir con el tenant ya resuelto)", async () => {
    const handler = new GetSchoolSettingsHandler(fakeSchools(null), fakeUow());

    await expect(handler.execute()).rejects.toThrow();
  });
});
