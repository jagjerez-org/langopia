import type { LangopiaClient } from "../client";
import type {
  CreateAcademyPlanRequest,
  UpdateAcademyPlanRequest,
  AcademyPlanResponse,
} from "../types";

export class AcademyPlansResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string): Promise<AcademyPlanResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/plans`,
      auth: "jwt",
    });
  }

  create(academyId: string, data: CreateAcademyPlanRequest): Promise<AcademyPlanResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/plans`,
      auth: "jwt",
      body: data,
    });
  }

  get(academyId: string, id: string): Promise<AcademyPlanResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/plans/${id}`,
      auth: "jwt",
    });
  }

  update(academyId: string, id: string, data: UpdateAcademyPlanRequest): Promise<AcademyPlanResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/plans/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  deactivate(academyId: string, id: string): Promise<AcademyPlanResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/plans/${id}/deactivate`,
      auth: "jwt",
    });
  }

  activate(academyId: string, id: string): Promise<AcademyPlanResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/plans/${id}/activate`,
      auth: "jwt",
    });
  }

  listPublic(slug: string): Promise<AcademyPlanResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/public/academy/${slug}/plans`,
      auth: "none",
    });
  }
}
