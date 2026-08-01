import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { AtRiskStudent, PortalReadModel } from "../../ports/portal-read-model.port.js";
import { GetStudentsAtRiskHandler } from "./get-students-at-risk.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");

function fakeClock(now: Date = NOW): Clock {
  return { now: () => now };
}

function fakeReadModel(
  rows: Array<Omit<AtRiskStudent, "reasons">>,
): PortalReadModel & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    studentsAtRisk: async (params) => {
      calls.push(params);
      return rows;
    },
    coreMetrics: async () => {
      throw new Error("no usado en esta prueba");
    },
    ownStudentId: async () => null,
    studentAccess: async () => ({ kind: "not_found" }),
    myStudents: async () => [],
    sessionsForStudent: async () => [],
    attendanceForStudent: async () => [],
    invoicesForStudent: async () => [],
  };
}

describe("GetStudentsAtRiskHandler (paso 1: riesgo de baja, versión mínima de la ola 1)", () => {
  it("asistencia por debajo del 60 % marca «low_attendance», como Lucía Ferrán en el seed (4 de 12)", async () => {
    const readModel = fakeReadModel([
      { studentId: "lucia", name: "Lucía Ferrán", attendanceRate: 0, weeksSinceLastEvaluation: 1 },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result).toEqual([
      {
        studentId: "lucia",
        name: "Lucía Ferrán",
        attendanceRate: 0,
        weeksSinceLastEvaluation: 1,
        reasons: ["low_attendance"],
      },
    ]);
  });

  it("sin ninguna valoración nunca marca «no_recent_evaluation», como Nerea Ojeda en el seed", async () => {
    const readModel = fakeReadModel([
      {
        studentId: "nerea",
        name: "Nerea Ojeda",
        attendanceRate: 0.917,
        weeksSinceLastEvaluation: null,
      },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result).toEqual([
      {
        studentId: "nerea",
        name: "Nerea Ojeda",
        attendanceRate: 0.917,
        weeksSinceLastEvaluation: null,
        reasons: ["no_recent_evaluation"],
      },
    ]);
  });

  it("tres semanas o más sin valoración también marca riesgo, aunque haya habido alguna", async () => {
    const readModel = fakeReadModel([
      { studentId: "x", name: "Equis", attendanceRate: 0.9, weeksSinceLastEvaluation: 3 },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result[0]!.reasons).toEqual(["no_recent_evaluation"]);
  });

  it("las dos señales a la vez producen los dos motivos", async () => {
    const readModel = fakeReadModel([
      { studentId: "y", name: "Ye", attendanceRate: 0.2, weeksSinceLastEvaluation: null },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result[0]!.reasons).toEqual(["low_attendance", "no_recent_evaluation"]);
  });

  it("un alumno sano —buena asistencia y valorado hace poco— no sale en la lista, como Paula Vidal (12 de 12)", async () => {
    const readModel = fakeReadModel([
      { studentId: "paula", name: "Paula Vidal", attendanceRate: 1, weeksSinceLastEvaluation: 0 },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result).toEqual([]);
  });

  it("sin ninguna clase en la ventana no fuerza «low_attendance»: `attendanceRate` nulo no es «por debajo del 60 %»", async () => {
    const readModel = fakeReadModel([
      { studentId: "z", name: "Zeta", attendanceRate: null, weeksSinceLastEvaluation: 0 },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result).toEqual([]);
  });

  it("pide al modelo de lectura una ventana de cuatro semanas terminada en «ahora»", async () => {
    const readModel = fakeReadModel([]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    await handler.execute();

    expect(readModel.calls).toEqual([
      {
        attendanceFrom: new Date(NOW.getTime() - 28 * 24 * 3_600_000),
        attendanceTo: NOW,
        now: NOW,
      },
    ]);
  });
});
