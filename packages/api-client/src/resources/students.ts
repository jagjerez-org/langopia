import type { LangopiaClient } from "../client";
import type {
  QueryStudentsParams,
  StudentResponse,
  StudentDetailResponse,
  Paginated,
} from "../types";

export class StudentsResource {
  constructor(private client: LangopiaClient) {}

  list(params?: QueryStudentsParams): Promise<Paginated<StudentResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/students",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  get(id: string): Promise<StudentDetailResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/students/${id}`,
      auth: "apikey",
    });
  }

  deactivate(id: string): Promise<StudentResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/students/${id}/deactivate`,
      auth: "apikey",
    });
  }

  activate(id: string): Promise<StudentResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/students/${id}/activate`,
      auth: "apikey",
    });
  }
}
