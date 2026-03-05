import type { LangopiaClient } from "../client";
import type {
  CreateRoomRequest,
  QueryRoomsParams,
  RoomResponse,
  ChatMessageResponse,
  RoomNotesResponse,
  ClassReportResponse,
  Paginated,
} from "../types";

export class RoomsResource {
  constructor(private client: LangopiaClient) {}

  create(data: CreateRoomRequest): Promise<RoomResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/rooms",
      auth: "apikey",
      body: data,
    });
  }

  list(params?: QueryRoomsParams): Promise<Paginated<RoomResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/rooms",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  get(id: string): Promise<RoomResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/rooms/${id}`,
      auth: "apikey",
    });
  }

  delete(id: string): Promise<RoomResponse> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/rooms/${id}`,
      auth: "apikey",
    });
  }

  getChat(id: string): Promise<ChatMessageResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/v1/rooms/${id}/chat`,
      auth: "apikey",
    });
  }

  getNotes(id: string): Promise<RoomNotesResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/rooms/${id}/notes`,
      auth: "apikey",
    });
  }

  getReport(id: string): Promise<ClassReportResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/rooms/${id}/report`,
      auth: "apikey",
    });
  }
}
