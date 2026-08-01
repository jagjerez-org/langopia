import { describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import {
  ClaudeTranscriptSummarizerAdapter,
  MissingTranscriptSummarizerCredentialsError,
} from "./claude-transcript-summarizer.adapter.js";

describe("ClaudeTranscriptSummarizerAdapter", () => {
  it("falla limpio si falta ANTHROPIC_API_KEY", async () => {
    const adapter = new ClaudeTranscriptSummarizerAdapter(
      new ConfigService({ ANTHROPIC_API_KEY: undefined }),
    );

    await expect(
      adapter.summarizeClass({
        transcriptId: "33333333-3333-4333-8333-333333333333",
        sessionId: "22222222-2222-4222-8222-222222222222",
        language: "en",
        segments: [{ startMs: 0, endMs: 1000, text: "hello", speakerLabel: "Lucía", isTeacher: false }],
      }),
    ).rejects.toBeInstanceOf(MissingTranscriptSummarizerCredentialsError);
  });
});
