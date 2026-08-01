import { describe, expect, it } from "vitest";
import { normalizeTeamsTranscript } from "./teams-transcript.adapter.js";

describe("normalizeTeamsTranscript", () => {
  it("normaliza segmentos de Teams al formato común de classroom", () => {
    expect(
      normalizeTeamsTranscript({
        language: "es",
        utterances: [
          {
            startMs: 10000,
            endMs: 13000,
            text: "Vamos a practicar el pasado.",
            speaker: { displayName: "Dan" },
            confidence: 0.86,
          },
        ],
      }),
    ).toEqual({
      language: "es",
      durationMs: 13000,
      segments: [
        {
          startMs: 10000,
          endMs: 13000,
          text: "Vamos a practicar el pasado.",
          speakerLabel: "Dan",
          speakerMembershipId: null,
          confidenceBps: 8600,
          isTeacher: false,
        },
      ],
    });
  });
});
