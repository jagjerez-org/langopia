import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { Student } from "../../../domain/model/student.aggregate.js";
import type { MembershipProvisioningPort } from "../../../domain/ports/membership-provisioning.port.js";
import type { StudentRepository } from "../../../domain/ports/student.repository.port.js";
import { EnrolStudentCommand } from "./enrol-student.command.js";
import { EnrolStudentHandler } from "./enrol-student.handler.js";

const AHORA = new Date("2026-07-27T12:00:00Z");
const ESCUELA = "11111111-1111-4111-8111-111111111111";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeIds(): IdGenerator {
  let n = 0;
  return {
    generate: () => `00000000-0000-4000-8000-00000000000${++n}`,
  };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => "actor",
    roles: () => ["owner"],
    has: () => true,
  };
}

function fakeMembers(): MembershipProvisioningPort {
  let n = 0;
  return {
    provisionStudent: async () => `22222222-2222-4222-8222-00000000000${++n}`,
    provisionGuardian: async () => `33333333-3333-4333-8333-00000000000${++n}`,
    provisionTeacher: async () => `44444444-4444-4444-8444-00000000000${++n}`,
  };
}

function fakeStudents(): StudentRepository & { saved: Student[] } {
  const saved: Student[] = [];
  return {
    saved,
    find: async () => null,
    findOrFail: async () => {
      throw new Error("no usado en esta prueba");
    },
    save: async (s) => {
      saved.push(s);
    },
    countActive: async () => 0,
  };
}

function handlerWithStudents() {
  const students = fakeStudents();
  const h = new EnrolStudentHandler(
    students,
    fakeMembers(),
    fakeUow(),
    fakeEvents(),
    fakeTenant(),
    fakeClock(),
    fakeIds(),
  );
  return { handler: h, students };
}

/**
 * Bug heredado detectado en la Tarea 14 (importación CSV) y cerrado aquí, en
 * la Tarea 15: `currentLevel` viajaba en `EnrolStudentCommand`, el DTO lo
 * validaba, pero `EnrolStudentHandler` nunca llamaba a `Student.changeLevel()`
 * — el nivel MCER del alta se perdía en silencio, tanto en `POST /students`
 * como en la vía de importación, que reutiliza este mismo comando. La vía de
 * EDICIÓN (`UpdateStudentHandler`) sí lo aplicaba correctamente.
 */
describe("EnrolStudentHandler — currentLevel en el alta (bug heredado, Tarea 15)", () => {
  it("persiste el nivel MCER recibido en el alta y lo devuelve", async () => {
    const { handler: h, students } = handlerWithStudents();

    const result = await h.execute(
      new EnrolStudentCommand({
        name: "Ana Pérez",
        email: "ana@example.com",
        dateOfBirth: "1990-01-01",
        nativeLanguage: "es",
        targetLanguage: "en",
        currentLevel: "B1",
      }),
    );

    expect(result.currentLevel).toBe("B1");
    expect(students.saved).toHaveLength(1);
    expect(students.saved[0]!.currentLevel).toBe("B1");
  });

  it("sin currentLevel en la petición, el alumno queda sin nivel asignado", async () => {
    const { handler: h } = handlerWithStudents();

    const result = await h.execute(
      new EnrolStudentCommand({
        name: "Berta López",
        email: "berta@example.com",
        dateOfBirth: "1990-01-01",
        nativeLanguage: "es",
        targetLanguage: "en",
      }),
    );

    expect(result.currentLevel).toBeNull();
  });
});
