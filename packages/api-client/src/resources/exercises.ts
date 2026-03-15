import type { LangopiaClient } from "../client";
import type {
  CreateExerciseRequest,
  CreateSingleExerciseRequest,
  QueryExercisesParams,
  SearchExercisesRequest,
  AnalyzeExerciseRequest,
  RefinePlanRequest,
  RefinePlanResponse,
  UpdateExerciseRequest,
  RegenerateExerciseRequest,
  ExerciseResponse,
  AnalyzeExerciseResponse,
  PreviewExercisesRequest,
  PreviewExercisesResponse,
  RefinePreviewRequest,
  RefinePreviewResponse,
  BulkSaveExercisesRequest,
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

  createSingle(data: CreateSingleExerciseRequest): Promise<{ data: ExerciseResponse }> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises/single",
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
    if (data.mediaItemIds) {
      for (const id of data.mediaItemIds) {
        formData.append("mediaItemIds", id);
      }
    }

    return this.client.request({
      method: "POST",
      path: "/v1/exercises/analyze",
      auth: "apikey",
      formData,
    });
  }

  preview(file: File | Blob | null, data: PreviewExercisesRequest): Promise<PreviewExercisesResponse> {
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (data.topic) formData.append("topic", data.topic);
    if (data.language) formData.append("language", data.language);
    if (data.cefrLevel) formData.append("cefrLevel", data.cefrLevel);
    if (data.materialContext) formData.append("materialContext", data.materialContext);
    if (data.mediaItemIds) {
      for (const id of data.mediaItemIds) {
        formData.append("mediaItemIds", id);
      }
    }
    if (data.exercises) {
      formData.append("exercises", JSON.stringify(data.exercises));
    }

    return this.client.request({
      method: "POST",
      path: "/v1/exercises/preview",
      auth: "apikey",
      formData,
    });
  }

  refinePreview(data: RefinePreviewRequest, signal?: AbortSignal): Promise<RefinePreviewResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises/preview/refine",
      auth: "apikey",
      body: data,
      signal,
    });
  }

  bulkSave(data: BulkSaveExercisesRequest): Promise<{ data: ExerciseResponse[] }> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises/bulk",
      auth: "apikey",
      body: data,
    });
  }

  refinePlan(data: RefinePlanRequest, signal?: AbortSignal): Promise<RefinePlanResponse> {
    return this.client.request({
      method: "POST",
      path: "/v1/exercises/analyze/refine",
      auth: "apikey",
      body: data,
      signal,
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
