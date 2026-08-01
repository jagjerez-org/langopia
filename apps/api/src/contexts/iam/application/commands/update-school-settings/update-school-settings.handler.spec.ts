import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type {
  SchoolRepositoryPort,
  SchoolSettings,
  UpdateSchoolSettingsInput,
} from "../../../domain/ports/school-repository.port.js";
import { UpdateSchoolSettingsCommand } from "./update-school-settings.command.js";
import { UpdateSchoolSettingsHandler } from "./update-school-settings.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const MEMBRESIA = "22222222-2222-4222-8222-222222222222";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => MEMBRESIA,
    roles: () => ["owner"],
    has: (role: string) => role === "owner",
  };
}

function fakeAuditLog(): AuditLogPort & { entries: AuditLogEntry[] } {
  const entries: AuditLogEntry[] = [];
  return { entries, record: async (entry) => void entries.push(entry) };
}

function fakeSchools(initial: SchoolSettings): SchoolRepositoryPort {
  let current = initial;
  return {
    save: async () => undefined,
    existsBySlug: async () => false,
    findCurrent: async () => current,
    updateSettings: async (input: UpdateSchoolSettingsInput) => {
      current = {
        ...current,
        name: input.name ?? current.name,
        defaultLocale: input.defaultLocale ?? current.defaultLocale,
        supportedLocales: input.supportedLocales ?? current.supportedLocales,
      };
      return current;
    },
  };
}

const ESTADO_INICIAL: SchoolSettings = {
  name: "Academia Nueva",
  defaultLocale: "es-ES",
  supportedLocales: ["es-ES"],
  status: "trial",
  trialEndsAt: new Date("2026-08-10T00:00:00Z"),
};

describe("UpdateSchoolSettingsHandler", () => {
  it("cambia el nombre y deja rastro en auditoría con el antes y el después", async () => {
    const schools = fakeSchools(ESTADO_INICIAL);
    const auditLog = fakeAuditLog();
    const handler = new UpdateSchoolSettingsHandler(schools, fakeUow(), auditLog, fakeTenant());

    const result = await handler.execute(new UpdateSchoolSettingsCommand({ name: "Academia Atlántico" }));

    expect(result.name).toBe("Academia Atlántico");
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA,
      action: "iam.school.settings_updated",
      before: { name: "Academia Nueva", defaultLocale: "es-ES" },
      after: { name: "Academia Atlántico", defaultLocale: "es-ES" },
    });
  });

  it("al cambiar el idioma por defecto, fija los idiomas soportados a ese único valor", async () => {
    const schools = fakeSchools(ESTADO_INICIAL);
    const handler = new UpdateSchoolSettingsHandler(schools, fakeUow(), fakeAuditLog(), fakeTenant());

    const result = await handler.execute(new UpdateSchoolSettingsCommand({ defaultLocale: "de-DE" }));

    expect(result.defaultLocale).toBe("de-DE");
    expect(result.supportedLocales).toEqual(["de-DE"]);
  });

  it("sin ningún campo no escribe nada ni deja rastro de auditoría", async () => {
    const schools = fakeSchools(ESTADO_INICIAL);
    const auditLog = fakeAuditLog();
    const handler = new UpdateSchoolSettingsHandler(schools, fakeUow(), auditLog, fakeTenant());

    const result = await handler.execute(new UpdateSchoolSettingsCommand({}));

    expect(result.name).toBe("Academia Nueva");
    expect(auditLog.entries).toHaveLength(0);
  });
});
