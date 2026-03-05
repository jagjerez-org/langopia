import type { LangopiaClient } from "../client";
import type {
  CreateAcademyRequest,
  UpdateAcademyRequest,
  AcademyResponse,
} from "../types";

export class AcademiesResource {
  constructor(private client: LangopiaClient) {}

  list(): Promise<AcademyResponse[]> {
    return this.client.request({
      method: "GET",
      path: "/academies",
      auth: "jwt",
    });
  }

  create(data: CreateAcademyRequest): Promise<AcademyResponse> {
    return this.client.request({
      method: "POST",
      path: "/academies",
      auth: "jwt",
      body: data,
    });
  }

  get(id: string): Promise<AcademyResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${id}`,
      auth: "jwt",
    });
  }

  update(id: string, data: UpdateAcademyRequest): Promise<AcademyResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  regenerateKey(id: string): Promise<AcademyResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${id}/regenerate-key`,
      auth: "jwt",
    });
  }
}
