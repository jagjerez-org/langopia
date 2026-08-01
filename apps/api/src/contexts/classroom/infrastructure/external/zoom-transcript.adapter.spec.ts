import { describe, expect, it } from "vitest";
import { parseZoomVtt } from "./zoom-transcript.adapter.js";

describe("parseZoomVtt", () => {
  it("normaliza segmentos VTT de Zoom al formato común de classroom", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.500
Carla: Good morning, everyone.

00:00:04.000 --> 00:00:07.000
Lucía Rojas: I have a question.
`;

    expect(parseZoomVtt(vtt)).toEqual([
      {
        startMs: 1000,
        endMs: 3500,
        text: "Good morning, everyone.",
        speakerLabel: "Carla",
        speakerMembershipId: null,
        confidenceBps: null,
        isTeacher: false,
      },
      {
        startMs: 4000,
        endMs: 7000,
        text: "I have a question.",
        speakerLabel: "Lucía Rojas",
        speakerMembershipId: null,
        confidenceBps: null,
        isTeacher: false,
      },
    ]);
  });
});
