import type { LangopiaClient } from "../client";
import type {
  CreateAcademyLevelRequest,
  UpdateAcademyLevelRequest,
  AcademyLevelResponse,
} from "../types";

export class AcademyLevelsResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string): Promise<AcademyLevelResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/levels`,
      auth: "jwt",
    });
  }

  create(academyId: string, data: CreateAcademyLevelRequest): Promise<AcademyLevelResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/levels`,
      auth: "jwt",
      body: data,
    });
  }

  update(academyId: string, id: string, data: UpdateAcademyLevelRequest): Promise<AcademyLevelResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/levels/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  delete(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/levels/${id}`,
      auth: "jwt",
    });
  }
}
