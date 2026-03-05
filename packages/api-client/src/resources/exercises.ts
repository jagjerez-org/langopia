import type { LangopiaClient } from "../client";
import type {
  CreateExerciseRequest,
  QueryExercisesParams,
  SearchExercisesRequest,
  AnalyzeExerciseRequest,
  UpdateExerciseRequest,
  RegenerateExerciseRequest,
  ExerciseResponse,
  AnalyzeExerciseResponse,
  Paginated,
} from "../types";

export class ExercisesResource {
  constructor(private client: LangopiaClient) {}

  list(params?: QueryExercisesParams): Promise<Paginated<ExerciseResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/exercises",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  create(data: CreateExerciseRequest): Promise<{ data: ExerciseResponse[] }> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises",
      auth: "apikey",
      body: data,
    });
  }

  search(data: SearchExercisesRequest): Promise<ExerciseResponse[]> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises/search",
      auth: "apikey",
      body: data,
    });
  }

  analyze(file: File | Blob | null, data: AnalyzeExerciseRequest): Promise<AnalyzeExerciseResponse> {
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (data.topic) formData.append("topic", data.topic);
    if (data.language) formData.append("language", data.language);
    if (data.cefrLevel) formData.append("cefrLevel", data.cefrLevel);
    if (data.materialContext) formData.append("materialContext", data.materialContext);

    return this.client.request({
      method: "POST",
      path: "/v1/exercises/analyze",
      auth: "apikey",
      formData,
    });
  }

  get(id: string): Promise<ExerciseResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/exercises/${id}`,
      auth: "apikey",
    });
  }

  update(id: string, data: UpdateExerciseRequest): Promise<ExerciseResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/exercises/${id}`,
      auth: "apikey",
      body: data,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/exercises/${id}`,
      auth: "apikey",
    });
  }

  regenerate(id: string, data?: RegenerateExerciseRequest): Promise<ExerciseResponse> {
    return this.client.request({
      method: "PUT",
      path: `/v1/exercises/${id}`,
      auth: "apikey",
      body: data,
    });
  }
}
