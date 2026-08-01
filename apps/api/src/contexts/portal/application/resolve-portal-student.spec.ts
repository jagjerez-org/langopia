import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../shared/domain/errors/domain-error.js";
import { PortalAccessDeniedError } from "../domain/errors/portal.errors.js";
import type { PortalReadModel, StudentAccess } from "./ports/portal-read-model.port.js";
import { resolvePortalStudentId } from "./resolve-portal-student.js";

function fakeReadModel(params: {
  own?: string | null;
  access?: (studentId: string, membershipId: string) => StudentAccess;
}): PortalReadModel {
  return {
    studentsAtRisk: async () => [],
    coreMetrics: async () => {
      throw new Error("no usado en esta prueba");
    },
    ownStudentId: async () => params.own ?? null,
    studentAccess: async (studentId, membershipId) =>
      params.access?.(studentId, membershipId) ?? { kind: "not_found" },
    myStudents: async () => [],
    sessionsForStudent: async () => [],
    attendanceForStudent: async () => [],
    invoicesForStudent: async () => [],
  };
}

describe("resolvePortalStudentId (paso 3+4: filtrado por membershipId, y su 403)", () => {
  it("sin studentId pedido, resuelve al alumno propio de la membresía", async () => {
    const readModel = fakeReadModel({ own: "student-a" });

    const result = await resolvePortalStudentId(readModel, "membership-a");

    expect(result).toBe("student-a");
  });

  it("sin studentId pedido y sin alumno propio (p. ej. un tutor sin hijos todavía), no lanza: devuelve null", async () => {
    const readModel = fakeReadModel({ own: null });

    const result = await resolvePortalStudentId(readModel, "membership-guardian-sin-hijos");

    expect(result).toBeNull();
  });

  it("pedir el propio studentId explícitamente funciona igual que omitirlo", async () => {
    const readModel = fakeReadModel({
      access: (studentId, membershipId) =>
        studentId === "student-a" && membershipId === "membership-a"
          ? { kind: "allowed", studentId }
          : { kind: "denied" },
    });

    const result = await resolvePortalStudentId(readModel, "membership-a", "student-a");

    expect(result).toBe("student-a");
  });

  it("un tutor puede pedir explícitamente el de su tutelado", async () => {
    const readModel = fakeReadModel({
      access: (studentId, membershipId) =>
        studentId === "student-hijo" && membershipId === "membership-tutor"
          ? { kind: "allowed", studentId }
          : { kind: "denied" },
    });

    const result = await resolvePortalStudentId(readModel, "membership-tutor", "student-hijo");

    expect(result).toBe("student-hijo");
  });

  it("PASO 4 — un alumno que pide el studentId de OTRO alumno de su misma escuela recibe 403, no la lista de otro ni una lista vacía silenciosa", async () => {
    const readModel = fakeReadModel({ access: () => ({ kind: "denied" }) });

    await expect(
      resolvePortalStudentId(readModel, "membership-alumno-a", "student-b"),
    ).rejects.toBeInstanceOf(PortalAccessDeniedError);
  });

  it("un studentId que RLS no deja ver (de otra escuela, o inexistente) da 404, no 403: la fila ni siquiera existe para ti", async () => {
    const readModel = fakeReadModel({ access: () => ({ kind: "not_found" }) });

    await expect(
      resolvePortalStudentId(readModel, "membership-alumno-a", "no-existe-o-es-de-otra-escuela"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
