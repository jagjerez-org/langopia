import type { LangopiaClient } from "../client";
import type {
  JoinRoomRequest,
  SendChatRequest,
  SaveNotesRequest,
  JoinRoomResponse,
  NotesResponse,
  RecordingResponse,
  EndRoomResponse,
} from "../types/room-internal";
import type { ChatMessageResponse } from "../types/rooms";

export class RoomInternalResource {
  constructor(private client: LangopiaClient) {}

  join(data: JoinRoomRequest): Promise<JoinRoomResponse> {
    return this.client.request({
      method: "POST",
      path: "/room/join",
      auth: "none",
      body: data,
    });
  }

  sendChat(roomId: string, data: SendChatRequest): Promise<ChatMessageResponse> {
    return this.client.request({
      method: "POST",
      path: `/room/${roomId}/chat`,
      auth: "none",
      body: data,
    });
  }

  saveNotes(roomId: string, data: SaveNotesRequest): Promise<NotesResponse> {
    return this.client.request({
      method: "PUT",
      path: `/room/${roomId}/notes`,
      auth: "none",
      body: data,
    });
  }

  startRecording(roomId: string): Promise<RecordingResponse> {
    return this.client.request({
      method: "POST",
      path: `/room/${roomId}/recording`,
      auth: "none",
    });
  }

  stopRecording(roomId: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/room/${roomId}/recording`,
      auth: "none",
    });
  }

  endRoom(roomId: string): Promise<EndRoomResponse> {
    return this.client.request({
      method: "POST",
      path: `/room/${roomId}/end`,
      auth: "none",
    });
  }
}
