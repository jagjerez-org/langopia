import { CommandBus } from "@nestjs/cqrs";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { Lead } from "../../../domain/model/lead.aggregate.js";
import type { LeadRepository } from "../../../domain/ports/lead.repository.port.js";
import { EnrolStudentCommand } from "../enrol-student/enrol-student.command.js";
import { ConvertLeadCommand } from "./convert-lead.command.js";
import { ConvertLeadHandler } from "./convert-lead.handler.js";

const AHORA = new Date("2026-07-28T10:00:00Z");
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function capturedLead() {
  return Lead.rehydrate({
    id: LEAD_ID,
    schoolId: "33333333-3333-4333-8333-333333333333",
    name: "Ana García",
    email: "ana@example.com",
    phone: null,
    locale: "es-ES",
    message: null,
    interestedLanguage: "en",
    declaredLevel: "A2",
    placementLevel: "B1",
    placementScore: 72,
    suggestedCourseId: null,
    status: "placement_done",
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

function build(commandResult: unknown) {
  const lead = capturedLead();
  const saved: Lead[] = [];
  const execute = vi.fn().mockResolvedValue(commandResult);
  const handler = new ConvertLeadHandler(
    {
      find: async () => lead,
      save: async (next) => {
        saved.push(next);
      },
      markColdCandidates: async () => 0,
    } satisfies LeadRepository,
    fakeUow(),
    { publish: async () => undefined } satisfies EventPublisher,
    { now: () => AHORA } satisfies Clock,
    { execute } as unknown as CommandBus,
  );
  return { handler, execute, saved };
}

describe("ConvertLeadHandler", () => {
  it("convierte reutilizando EnrolStudentCommand y persiste el alumno resultante", async () => {
    const { handler, execute, saved } = build({
      studentId: STUDENT_ID,
      guardianRequired: false,
      currentLevel: "B1",
    });

    await handler.execute(
      new ConvertLeadCommand({
        leadId: LEAD_ID,
        dateOfBirth: "1990-01-01",
        nativeLanguage: "es",
        targetLanguage: "en",
      }),
    );

    expect(execute).toHaveBeenCalledWith(expect.any(EnrolStudentCommand));
    expect((execute.mock.calls[0]![0] as EnrolStudentCommand).props.currentLevel).toBe("B1");
    expect(saved[0]!.status).toBe("converted");
    expect(saved[0]!.convertedStudentProfileId).toBe(STUDENT_ID);
  });

  it("un candidato menor exige tutor al convertir porque pasa por EnrolStudentCommand", async () => {
    const error = new Error("guardian_required");
    const { handler, execute, saved } = build(Promise.reject(error));

    await expect(
      handler.execute(
        new ConvertLeadCommand({
          leadId: LEAD_ID,
          dateOfBirth: "2012-01-01",
          nativeLanguage: "es",
          targetLanguage: "en",
        }),
      ),
    ).rejects.toThrow("guardian_required");

    expect(execute).toHaveBeenCalledWith(expect.any(EnrolStudentCommand));
    expect(saved).toEqual([]);
  });
});
