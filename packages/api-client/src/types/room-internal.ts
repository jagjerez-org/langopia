// ─── Requests ───────────────────────────────────────

export interface JoinRoomRequest {
  token: string;
  name?: string;
  email?: string;
}

export interface SendChatRequest {
  senderName: string;
  senderRole: string;
  message: string;
}

export interface SaveNotesRequest {
  vocabulary?: Array<{ word: string; definition: string; example: string }>;
  corrections?: Array<{ error: string; correction: string; context: string }>;
  homework?: string;
  objectives?: string;
}

// ─── Responses ──────────────────────────────────────

export interface JoinRoomResponse {
  livekitToken: string;
  livekitUrl: string;
  roomId: string;
  title: string;
  language: string;
  participantId: string;
  participantName: string;
  role: string;
  slides: string[];
  status: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

export interface NotesResponse {
  vocabulary: Array<{ word: string; definition: string; example: string }>;
  corrections: Array<{ error: string; correction: string; context: string }>;
  homework: string | null;
  objectives: string | null;
}

export interface RecordingResponse {
  egressId: string;
}

export interface EndRoomResponse {
  status: string;
}
