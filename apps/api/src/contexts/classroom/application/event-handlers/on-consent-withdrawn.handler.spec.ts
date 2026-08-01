import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { ConsentWithdrawn } from "../../../people/domain/events/student.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { TranscriptRepositoryPort } from "../../domain/ports/transcript-repository.port.js";
import { OnConsentWithdrawnDeleteTranscripts } from "./on-consent-withdrawn.handler.js";

const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "33333333-3333-4333-8333-333333333333";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function logger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function event(kind: string) {
  return new ConsentWithdrawn({
    studentId: STUDENT_ID,
    schoolId: SCHOOL_ID,
    kind,
    subjectMembershipId: MEMBERSHIP_ID,
  });
}

describe("OnConsentWithdrawnDeleteTranscripts", () => {
  it("borra transcripciones al retirar consentimiento de grabación", async () => {
    const deleteForParticipant = vi.fn().mockResolvedValue(2);
    const handler = new OnConsentWithdrawnDeleteTranscripts(
      { deleteForParticipant } as unknown as TranscriptRepositoryPort,
      fakeUow(),
      logger(),
    );

    await handler.handle(event("recording"));

    expect(deleteForParticipant).toHaveBeenCalledWith(MEMBERSHIP_ID);
  });

  it("ignora consentimientos que no afectan a audio ni transcripción", async () => {
    const deleteForParticipant = vi.fn();
    const handler = new OnConsentWithdrawnDeleteTranscripts(
      { deleteForParticipant } as unknown as TranscriptRepositoryPort,
      fakeUow(),
      logger(),
    );

    await handler.handle(event("marketing"));

    expect(deleteForParticipant).not.toHaveBeenCalled();
  });
});
