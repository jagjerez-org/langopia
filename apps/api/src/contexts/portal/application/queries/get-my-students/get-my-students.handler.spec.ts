import { describe, expect, it } from "vitest";
import type { PortalReadModel, PortalStudentOption } from "../../ports/portal-read-model.port.js";
import { GetMyStudentsHandler } from "./get-my-students.handler.js";

function fakeReadModel(students: PortalStudentOption[]): PortalReadModel {
  return {
    studentsAtRisk: async () => [],
    coreMetrics: async () => {
      throw new Error("no usado en esta prueba");
    },
    ownStudentId: async () => students[0]?.studentId ?? null,
    studentAccess: async () => ({ kind: "not_found" }),
    myStudents: async (membershipId: string) => (membershipId === "membership-tutor" ? students : []),
    sessionsForStudent: async () => [],
    attendanceForStudent: async () => [],
    invoicesForStudent: async () => [],
  };
}

function fakeTenant(membershipId: string | null) {
  return {
    schoolId: () => "school-a",
    membershipId: () => membershipId,
    roles: () => ["guardian"],
    has: (role: string) => role === "guardian",
  };
}

describe("GetMyStudentsHandler (Tarea 11 del panel web, Paso 2)", () => {
  it("un tutor con dos hijos matriculados recibe los dos, no solo el primero", async () => {
    const wards: PortalStudentOption[] = [
      { studentId: "student-jonas", name: "Jonas Weber" },
      { studentId: "student-lena", name: "Lena Weber" },
    ];
    const handler = new GetMyStudentsHandler(fakeReadModel(wards), fakeTenant("membership-tutor"));

    const result = await handler.execute();

    expect(result).toEqual(wards);
  });

  it("una membresía sin alumnos propios ni tutelados recibe una lista vacía, no un error", async () => {
    const handler = new GetMyStudentsHandler(
      fakeReadModel([{ studentId: "otro", name: "Otro" }]),
      fakeTenant("membership-sin-hijos"),
    );

    const result = await handler.execute();

    expect(result).toEqual([]);
  });
});
