import { describe, expect, it, vi } from "vitest";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { PlacementTestFinished } from "../../../assessment/domain/events/placement-test.events.js";
import { Lead } from "../../domain/model/lead.aggregate.js";
import type { LeadRepository } from "../../domain/ports/lead.repository.port.js";
import { OnPlacementTestFinishedAssignLevel } from "./on-placement-test-finished.handler.js";

const AHORA = new Date("2026-07-28T10:00:00Z");
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SCHOOL_ID = "33333333-3333-4333-8333-333333333333";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function lead(params: { status?: string; placementLevel?: string | null } = {}) {
  return Lead.rehydrate({
    id: LEAD_ID,
    schoolId: SCHOOL_ID,
    name: "Ana García",
    email: "ana@example.com",
    phone: null,
    locale: "es-ES",
    message: null,
    interestedLanguage: "en",
    declaredLevel: "A2",
    placementLevel: (params.placementLevel ?? null) as never,
    placementScore: null,
    suggestedCourseId: null,
    status: (params.status ?? "placement_sent") as never,
    sourcePage: "/contacto",
    sourceCampaign: null,
    referrer: null,
    convertedStudentProfileId: null,
    convertedAt: null,
    assignedToMembershipId: null,
    createdAt: AHORA.toISOString(),
    lastContactedAt: null,
    discardedReason: null,
  });
}

function placementFinished(studentProfileId: string, level = "B2") {
  return new PlacementTestFinished({
    placementTestId: "44444444-4444-4444-8444-444444444444",
    schoolId: SCHOOL_ID,
    studentProfileId,
    language: "en",
    level,
    skillLevels: { grammar: "B2", reading: "B1" },
    questionsAsked: 8,
  });
}

function build(found: Lead | null) {
  const saved: Lead[] = [];
  const handler = new OnPlacementTestFinishedAssignLevel(
    {
      find: async () => found,
      save: async (next) => {
        saved.push(next);
      },
      markColdCandidates: async () => 0,
    } satisfies LeadRepository,
    fakeUow(),
  );
  return { handler, saved };
}

describe("OnPlacementTestFinishedAssignLevel", () => {
  it("vuelca el nivel sugerido en el candidato cuando termina su nivelación", async () => {
    const { handler, saved } = build(lead());

    await handler.handle(placementFinished(LEAD_ID));

    expect(saved).toHaveLength(1);
    expect(saved[0]!.status).toBe("placement_done");
    expect(saved[0]!.placementLevel).toBe("B2");
  });

  it("no hace nada si la prueba no es de ningún candidato (alumno ya matriculado)", async () => {
    const { handler, saved } = build(null);

    await handler.handle(placementFinished("99999999-9999-4999-8999-999999999999"));

    expect(saved).toEqual([]);
  });

  it("no pisa un nivel ya asignado: el resultado se vuelca una sola vez", async () => {
    const { handler, saved } = build(lead({ status: "placement_done", placementLevel: "B1" }));

    await handler.handle(placementFinished(LEAD_ID, "C1"));

    expect(saved).toEqual([]);
  });

  it("no toca un candidato ya convertido en alumno", async () => {
    const { handler, saved } = build(lead({ status: "converted" }));

    await handler.handle(placementFinished(LEAD_ID));

    expect(saved).toEqual([]);
  });
});
