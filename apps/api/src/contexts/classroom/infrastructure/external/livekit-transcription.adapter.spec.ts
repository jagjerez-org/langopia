import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveKitTranscriptionAdapter } from "./livekit-transcription.adapter.js";

const ORIGINAL_URL = process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL;
const ORIGINAL_SECRET = process.env.LIVEKIT_TRANSCRIPTION_AGENT_SECRET;

function request() {
  return {
    sessionId: "22222222-2222-4222-8222-222222222222",
    transcriptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    language: "es",
    participantMembershipIds: ["33333333-3333-4333-8333-333333333333"],
  };
}

describe("LiveKitTranscriptionAdapter", () => {
  afterEach(() => {
    process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL = ORIGINAL_URL;
    process.env.LIVEKIT_TRANSCRIPTION_AGENT_SECRET = ORIGINAL_SECRET;
    vi.unstubAllGlobals();
  });

  it("en desarrollo no llama a red si no hay agente configurado", async () => {
    delete process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const result = await new LiveKitTranscriptionAdapter().startLiveTranscription(request());

    expect(result.providerRef).toEqual(expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envía el arranque al agente configurado con firma", async () => {
    process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL = "https://livekit.example.test/transcribe";
    process.env.LIVEKIT_TRANSCRIPTION_AGENT_SECRET = "secret";
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);

    await new LiveKitTranscriptionAdapter().startLiveTranscription(request());

    expect(fetch).toHaveBeenCalledWith(
      "https://livekit.example.test/transcribe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-langopia-signature": expect.any(String),
        }),
        body: expect.stringContaining("\"transcriptId\":\"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\""),
      }),
    );
  });
});
