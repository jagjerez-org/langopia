import type { LangopiaClient } from "../client";
import type {
  CreateCourseRequest,
  UpdateCourseRequest,
  QueryCoursesParams,
  ManageCourseLessonsRequest,
  CourseResponse,
  Paginated,
} from "../types";

export class CoursesResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string, params?: QueryCoursesParams): Promise<Paginated<CourseResponse>> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/courses`,
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  create(academyId: string, data: CreateCourseRequest): Promise<CourseResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/courses`,
      auth: "jwt",
      body: data,
    });
  }

  get(academyId: string, id: string): Promise<CourseResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/courses/${id}`,
      auth: "jwt",
    });
  }

  update(academyId: string, id: string, data: UpdateCourseRequest): Promise<CourseResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/courses/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  delete(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/courses/${id}`,
      auth: "jwt",
    });
  }

  setLessons(academyId: string, courseId: string, data: ManageCourseLessonsRequest): Promise<CourseResponse> {
    return this.client.request({
      method: "PUT",
      path: `/academies/${academyId}/courses/${courseId}/lessons`,
      auth: "jwt",
      body: data,
    });
  }
}
