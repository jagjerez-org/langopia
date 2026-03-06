import type { LangopiaClient } from "../client";
import type {
  UpdateAcademyLandingRequest,
  AcademyLandingResponse,
} from "../types";

export class AcademyLandingResource {
  constructor(private client: LangopiaClient) {}

  get(academyId: string): Promise<AcademyLandingResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/landing`,
      auth: "jwt",
    });
  }

  update(academyId: string, data: UpdateAcademyLandingRequest): Promise<AcademyLandingResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/landing`,
      auth: "jwt",
      body: data,
    });
  }

  getPublic(slug: string): Promise<AcademyLandingResponse> {
    return this.client.request({
      method: "GET",
      path: `/public/academy/${slug}/landing`,
      auth: "none",
    });
  }
}
