import type { RoomStatus, ParticipantRole, ReportStatus } from "@langopia/shared/types";
import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface CreateRoomRequest {
  title: string;
  language?: string;
  maxStudents?: number;
  slides?: string[];
  scheduledAt?: string;
  lessonId?: string;
}

export interface QueryRoomsParams extends PaginationParams {
  status?: RoomStatus | string;
}

// ─── Responses ──────────────────────────────────────

export interface RoomParticipantResponse {
  id: string;
  name: string;
  email: string | null;
  role: ParticipantRole;
  joinedAt: string;
  leftAt: string | null;
}

export interface RoomResponse {
  id: string;
  title: string;
  language: string;
  maxStudents: number;
  status: RoomStatus;
  teacherToken: string;
  studentToken: string;
  teacherUrl: string;
  studentUrl: string;
  slides: string[];
  lessonId: string | null;
  academyId: string;
  participants?: RoomParticipantResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageResponse {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface RoomNotesResponse {
  id: string;
  vocabulary: Array<{ word: string; definition: string; example: string }>;
  corrections: Array<{ error: string; correction: string; context: string }>;
  homework: string | null;
  objectives: string | null;
}

export interface ClassReportResponse {
  id: string;
  status: ReportStatus;
  summary: string | null;
  analysis: Record<string, unknown> | null;
  roomId: string;
  createdAt: string;
}
