import { describe, expect, it } from "vitest";
import { ClassVocabularyExtracted } from "../../../classroom/domain/events/transcript.events.js";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { SchoolCalendarPort } from "../../domain/ports/school-calendar.port.js";
import type { SrsCardRepository } from "../../domain/ports/srs-card.repository.port.js";
import { OnClassVocabularyExtracted } from "./on-class-vocabulary-extracted.handler.js";

const NOW = new Date("2026-07-28T12:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

describe("OnClassVocabularyExtracted", () => {
  it("crea tarjetas SRS de vocabulario para los alumnos participantes", async () => {
    const calls: unknown[] = [];
    const cards = {
      createVocabularyCardsForParticipants: async (params: unknown) => {
        calls.push(params);
        return 2;
      },
    } as unknown as SrsCardRepository;
    const calendar: SchoolCalendarPort = { today: async () => "2026-07-28" };
    const clock: Clock = { now: () => NOW };
    const handler = new OnClassVocabularyExtracted(cards, calendar, fakeUow(), clock);

    await handler.handle(
      new ClassVocabularyExtracted({
        transcriptId: "33333333-3333-4333-8333-333333333333",
        schoolId: "11111111-1111-4111-8111-111111111111",
        sessionId: "22222222-2222-4222-8222-222222222222",
        language: "en",
        participantMembershipIds: ["44444444-4444-4444-8444-444444444444"],
        vocabulary: [{ term: "look up", lemma: "look up", level: "B1", count: 2 }],
      }),
    );

    expect(calls).toEqual([
      {
        schoolId: "11111111-1111-4111-8111-111111111111",
        transcriptId: "33333333-3333-4333-8333-333333333333",
        participantMembershipIds: ["44444444-4444-4444-8444-444444444444"],
        vocabulary: [{ term: "look up", lemma: "look up", level: "B1", count: 2 }],
        dueOn: "2026-07-28",
        now: NOW,
      },
    ]);
  });
});
