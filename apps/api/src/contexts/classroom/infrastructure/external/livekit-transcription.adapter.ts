import { createHmac, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  StartLiveTranscriptionRequest,
  StartLiveTranscriptionResult,
  TranscriptionPort,
} from "../../domain/ports/transcription.port.js";

const DEFAULT_AGENT_URL = "http://localhost:7880/langopia/transcription-agent";
const DEFAULT_AGENT_SECRET = "langopia-dev-transcription-secret";

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

@Injectable()
export class LiveKitTranscriptionAdapter implements TranscriptionPort {
  private get agentUrl(): string {
    return process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL ?? DEFAULT_AGENT_URL;
  }

  private get agentSecret(): string {
    return process.env.LIVEKIT_TRANSCRIPTION_AGENT_SECRET ?? DEFAULT_AGENT_SECRET;
  }

  async startLiveTranscription(
    request: StartLiveTranscriptionRequest,
  ): Promise<StartLiveTranscriptionResult> {
    const providerRef = randomUUID();
    const body = JSON.stringify({
      providerRef,
      roomName: request.sessionId,
      transcriptId: request.transcriptId,
      language: request.language,
      participantMembershipIds: request.participantMembershipIds,
    });

    if (process.env.LIVEKIT_TRANSCRIPTION_AGENT_URL) {
      const response = await fetch(this.agentUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-langopia-signature": signature(body, this.agentSecret),
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`El agente de transcripción de LiveKit respondió ${response.status}.`);
      }
    }

    return { providerRef };
  }
}
