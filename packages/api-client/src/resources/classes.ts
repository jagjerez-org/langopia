import type { LangopiaClient } from "../client";
import type {
  CreateClassRequest,
  UpdateClassRequest,
  QueryClassesParams,
  CancelClassRequest,
  ClassResponse,
  Paginated,
} from "../types";

export class ClassesResource {
  constructor(private client: LangopiaClient) {}

  create(data: CreateClassRequest): Promise<ClassResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/classes",
      auth: "apikey",
      body: data,
    });
  }

  list(params?: QueryClassesParams): Promise<Paginated<ClassResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/classes",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  get(id: string): Promise<ClassResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/classes/${id}`,
      auth: "apikey",
    });
  }

  update(id: string, data: UpdateClassRequest): Promise<ClassResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/classes/${id}`,
      auth: "apikey",
      body: data,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/classes/${id}`,
      auth: "apikey",
    });
  }

  cancel(id: string, data?: CancelClassRequest): Promise<ClassResponse> {
    return this.client.request({
      method: "POST",
      path: `/v1/classes/${id}/cancel`,
      auth: "apikey",
      body: data,
    });
  }
}
