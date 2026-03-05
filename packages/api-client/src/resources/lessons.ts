import type { LangopiaClient } from "../client";
import type {
  CreateLessonRequest,
  UpdateLessonRequest,
  QueryLessonsParams,
  GenerateLessonExercisesRequest,
  LinkExercisesRequest,
  QueryLessonExercisesParams,
  LessonResponse,
  Paginated,
} from "../types";
import type { ExerciseResponse } from "../types/exercises";

export class LessonsResource {
  constructor(private client: LangopiaClient) {}

  list(params?: QueryLessonsParams): Promise<Paginated<LessonResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/lessons",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  create(data: CreateLessonRequest): Promise<LessonResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/lessons",
      auth: "apikey",
      body: data,
    });
  }

  get(id: string): Promise<LessonResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/lessons/${id}`,
      auth: "apikey",
    });
  }

  update(id: string, data: UpdateLessonRequest): Promise<LessonResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/lessons/${id}`,
      auth: "apikey",
      body: data,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/lessons/${id}`,
      auth: "apikey",
    });
  }

  listExercises(
    lessonId: string,
    params?: QueryLessonExercisesParams,
  ): Promise<Paginated<ExerciseResponse>> {
    return this.client.request({
      method: "GET",
      path: `/v1/lessons/${lessonId}/exercises`,
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  generateExercises(
    lessonId: string,
    data: GenerateLessonExercisesRequest,
    files?: (File | Blob)[],
  ): Promise<ExerciseResponse[]> {
    const formData = new FormData();
    formData.append("exercises", JSON.stringify(data.exercises));
    if (data.topic) formData.append("topic", data.topic);
    if (files) {
      for (const file of files) {
        formData.append("file", file);
      }
    }

    return this.client.request({
      method: "POST",
      path: `/v1/lessons/${lessonId}/exercises`,
      auth: "apikey",
      formData,
    });
  }

  linkExercises(lessonId: string, data: LinkExercisesRequest): Promise<LessonResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/lessons/${lessonId}/exercises`,
      auth: "apikey",
      body: data,
    });
  }

  unlinkExercise(lessonId: string, exerciseId: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/lessons/${lessonId}/exercises`,
      auth: "apikey",
      query: { exerciseId },
    });
  }
}
