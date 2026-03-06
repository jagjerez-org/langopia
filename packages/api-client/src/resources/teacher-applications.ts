import type { LangopiaClient } from "../client";
import type {
  SubmitApplicationRequest,
  ReviewApplicationRequest,
  CreateCustomFieldRequest,
  TeacherApplicationResponse,
  ApplicationCustomFieldResponse,
} from "../types";

export class TeacherApplicationsResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string, status?: string): Promise<TeacherApplicationResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/teacher-applications`,
      auth: "jwt",
      query: status ? { status } : undefined,
    });
  }

  get(academyId: string, id: string): Promise<TeacherApplicationResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/teacher-applications/${id}`,
      auth: "jwt",
    });
  }

  review(academyId: string, id: string, data: ReviewApplicationRequest): Promise<TeacherApplicationResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/teacher-applications/${id}/review`,
      auth: "jwt",
      body: data,
    });
  }

  listCustomFields(academyId: string): Promise<ApplicationCustomFieldResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/application-fields`,
      auth: "jwt",
    });
  }

  createCustomField(academyId: string, data: CreateCustomFieldRequest): Promise<ApplicationCustomFieldResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/application-fields`,
      auth: "jwt",
      body: data,
    });
  }

  deleteCustomField(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/application-fields/${id}`,
      auth: "jwt",
    });
  }

  submitPublic(slug: string, data: SubmitApplicationRequest): Promise<TeacherApplicationResponse> {
    return this.client.request({
      method: "POST",
      path: `/public/academy/${slug}/apply`,
      auth: "none",
      body: data,
    });
  }

  getPublicCustomFields(slug: string): Promise<ApplicationCustomFieldResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/public/academy/${slug}/application-fields`,
      auth: "none",
    });
  }
}
