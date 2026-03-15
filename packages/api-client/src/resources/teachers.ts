import type { LangopiaClient } from "../client";
import type {
  InviteTeacherRequest,
  TeacherResponse,
  TeacherDetailResponse,
  InviteTeacherResponse,
} from "../types";

export class TeachersResource {
  constructor(private client: LangopiaClient) {}

  list(): Promise<TeacherResponse[]> {
    return this.client.request({
      method: "GET",
      path: "/v1/teachers",
      auth: "apikey",
    });
  }

  get(id: string): Promise<TeacherDetailResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/teachers/${id}`,
      auth: "apikey",
    });
  }

  invite(data: InviteTeacherRequest): Promise<InviteTeacherResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/teachers",
      auth: "apikey",
      body: data,
    });
  }

  remove(id: string): Promise<{ success: boolean }> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/teachers/${id}`,
      auth: "apikey",
    });
  }

  deactivate(id: string): Promise<{ id: string; roles: string[] }> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/teachers/${id}/deactivate`,
      auth: "apikey",
    });
  }

  reactivate(id: string): Promise<{ id: string; roles: string[] }> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/teachers/${id}/reactivate`,
      auth: "apikey",
    });
  }
}
