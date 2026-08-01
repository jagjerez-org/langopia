export type StartLiveTranscriptionRequest = {
  sessionId: string;
  transcriptId: string;
  language: string;
  participantMembershipIds: string[];
};

export type StartLiveTranscriptionResult = {
  providerRef: string;
};

export interface TranscriptionPort {
  startLiveTranscription(
    request: StartLiveTranscriptionRequest,
  ): Promise<StartLiveTranscriptionResult>;
}

export const TRANSCRIPTION_PORT = Symbol("TranscriptionPort");
