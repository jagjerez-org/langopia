import type { LangopiaClient } from "../client";
import type {
  InviteTeacherRequest,
  TeacherResponse,
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

  get(id: string): Promise<TeacherResponse> {
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
}
