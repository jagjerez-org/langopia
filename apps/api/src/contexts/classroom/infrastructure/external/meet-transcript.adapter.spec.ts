import { describe, expect, it } from "vitest";
import { normalizeMeetTranscript } from "./meet-transcript.adapter.js";

describe("normalizeMeetTranscript", () => {
  it("normaliza segmentos de Google Meet al formato común de classroom", () => {
    expect(
      normalizeMeetTranscript({
        language: "en",
        segments: [
          {
            startTimeMs: 2000,
            endTimeMs: 4500,
            text: "Let's review the homework.",
            participantName: "Sofía",
            confidence: 0.91,
          },
        ],
      }),
    ).toEqual({
      language: "en",
      durationMs: 4500,
      segments: [
        {
          startMs: 2000,
          endMs: 4500,
          text: "Let's review the homework.",
          speakerLabel: "Sofía",
          speakerMembershipId: null,
          confidenceBps: 9100,
          isTeacher: false,
        },
      ],
    });
  });
});
