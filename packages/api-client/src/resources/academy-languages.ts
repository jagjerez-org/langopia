import type { LangopiaClient } from "../client";
import type {
  CreateAcademyLanguageRequest,
  UpdateAcademyLanguageRequest,
  AcademyLanguageResponse,
} from "../types";

export class AcademyLanguagesResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string): Promise<AcademyLanguageResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/languages`,
      auth: "jwt",
    });
  }

  create(academyId: string, data: CreateAcademyLanguageRequest): Promise<AcademyLanguageResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/languages`,
      auth: "jwt",
      body: data,
    });
  }

  update(academyId: string, id: string, data: UpdateAcademyLanguageRequest): Promise<AcademyLanguageResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/languages/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  delete(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/languages/${id}`,
      auth: "jwt",
    });
  }
}
