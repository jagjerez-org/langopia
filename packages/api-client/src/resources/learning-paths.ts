import type { LangopiaClient } from "../client";
import type {
  UpdateLearningPathRequest,
  QueryLearningPathsParams,
  AddLessonsRequest,
  ReorderLessonsRequest,
  LearningPathResponse,
  Paginated,
} from "../types";
import type { LessonResponse } from "../types/lessons";

export class LearningPathsResource {
  constructor(private client: LangopiaClient) {}

  list(params?: QueryLearningPathsParams): Promise<Paginated<LearningPathResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/learning-paths",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  get(id: string): Promise<LearningPathResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/learning-paths/${id}`,
      auth: "apikey",
    });
  }

  update(id: string, data: UpdateLearningPathRequest): Promise<LearningPathResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/learning-paths/${id}`,
      auth: "apikey",
      body: data,
    });
  }

  listLessons(id: string): Promise<LessonResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/v1/learning-paths/${id}/lessons`,
      auth: "apikey",
    });
  }

  addLessons(id: string, data: AddLessonsRequest): Promise<LearningPathResponse> {
    return this.client.request({
      method: "POST",
      path: `/v1/learning-paths/${id}/lessons`,
      auth: "apikey",
      body: data,
    });
  }

  reorderLessons(id: string, data: ReorderLessonsRequest): Promise<LearningPathResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/learning-paths/${id}/lessons`,
      auth: "apikey",
      body: data,
    });
  }

  removeLesson(id: string, lessonId: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/learning-paths/${id}/lessons`,
      auth: "apikey",
      query: { lessonId },
    });
  }

  listCourses(id: string): Promise<unknown[]> {
    return this.client.request({
      method: "GET",
      path: `/v1/learning-paths/${id}/courses`,
      auth: "apikey",
    });
  }

  addCourses(id: string, courseIds: string[]): Promise<LearningPathResponse> {
    return this.client.request({
      method: "POST",
      path: `/v1/learning-paths/${id}/courses`,
      auth: "apikey",
      body: { courseIds },
    });
  }

  reorderCourses(id: string, courseIds: string[]): Promise<LearningPathResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/learning-paths/${id}/courses`,
      auth: "apikey",
      body: { courseIds },
    });
  }

  removeCourse(id: string, courseId: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/learning-paths/${id}/courses`,
      auth: "apikey",
      query: { courseId },
    });
  }
}
