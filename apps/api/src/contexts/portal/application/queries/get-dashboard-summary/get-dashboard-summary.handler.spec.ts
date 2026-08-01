import type { QueryBus } from "@nestjs/cqrs";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { AtRiskStudent, DashboardCoreMetrics, PortalReadModel } from "../../ports/portal-read-model.port.js";
import { GetDashboardSummaryHandler } from "./get-dashboard-summary.handler.js";
import { GetStudentsAtRiskQuery } from "../get-students-at-risk/get-students-at-risk.handler.js";

function fakeReadModel(
  core: DashboardCoreMetrics,
): PortalReadModel & { coreMetricsCalls: unknown[] } {
  const coreMetricsCalls: unknown[] = [];
  return {
    coreMetricsCalls,
    studentsAtRisk: async () => [],
    coreMetrics: async (params) => {
      coreMetricsCalls.push(params);
      return core;
    },
    ownStudentId: async () => null,
    studentAccess: async () => ({ kind: "not_found" }),
    myStudents: async () => [],
    sessionsForStudent: async () => [],
    attendanceForStudent: async () => [],
    invoicesForStudent: async () => [],
  };
}

function fakeClock(now: Date): Clock {
  return { now: () => now };
}

function fakeQueryBus(atRisk: AtRiskStudent[]): QueryBus & { executed: unknown[] } {
  const executed: unknown[] = [];
  return {
    executed,
    execute: async (query: unknown) => {
      executed.push(query);
      return atRisk;
    },
  } as unknown as QueryBus & { executed: unknown[] };
}

describe("GetDashboardSummaryHandler (paso 2: resumen del panel de dirección)", () => {
  it("compone alumnos activos, asistencia media, facturado del mes y el riesgo de baja; el NPS queda ausente", async () => {
    const now = new Date("2026-07-27T10:00:00Z");
    const atRisk: AtRiskStudent[] = [
      {
        studentId: "lucia",
        name: "Lucía Ferrán",
        attendanceRate: 0,
        weeksSinceLastEvaluation: 1,
        reasons: ["low_attendance"],
      },
    ];
    const readModel = fakeReadModel({
      activeStudents: 50,
      averageAttendanceRate: 0.83,
      invoicedThisMonthCents: 190_00,
      currency: "EUR",
    });
    const queries = fakeQueryBus(atRisk);
    const handler = new GetDashboardSummaryHandler(readModel, fakeClock(now), queries);

    const result = await handler.execute();

    expect(result).toEqual({
      activeStudents: 50,
      averageAttendanceRate: 0.83,
      nps: null,
      invoicedThisMonth: { amountCents: 190_00, currency: "EUR" },
      studentsRequiringAttention: atRisk,
    });
  });

  it("reutiliza la consulta de riesgo de baja del Paso 1 por el bus, en vez de recalcularla", async () => {
    const readModel = fakeReadModel({
      activeStudents: 0,
      averageAttendanceRate: 0,
      invoicedThisMonthCents: 0,
      currency: "EUR",
    });
    const queries = fakeQueryBus([]);
    const handler = new GetDashboardSummaryHandler(
      readModel,
      fakeClock(new Date("2026-07-27T10:00:00Z")),
      queries,
    );

    await handler.execute();

    expect(queries.executed).toHaveLength(1);
    expect(queries.executed[0]).toBeInstanceOf(GetStudentsAtRiskQuery);
  });

  it("pide facturado del mes sobre el mes natural en curso, y asistencia sobre las últimas cuatro semanas", async () => {
    const now = new Date("2026-07-27T10:00:00Z");
    const readModel = fakeReadModel({
      activeStudents: 0,
      averageAttendanceRate: 0,
      invoicedThisMonthCents: 0,
      currency: "EUR",
    });
    const handler = new GetDashboardSummaryHandler(readModel, fakeClock(now), fakeQueryBus([]));

    await handler.execute();

    expect(readModel.coreMetricsCalls).toEqual([
      {
        attendanceFrom: new Date(now.getTime() - 28 * 24 * 3_600_000),
        attendanceTo: now,
        invoicedFrom: new Date(2026, 6, 1),
        invoicedTo: new Date(2026, 7, 1),
      },
    ]);
  });
});
