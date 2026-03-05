import type { LangopiaClient } from "../client";
import type {
  UploadMediaRequest,
  BulkUploadMediaRequest,
  QueryMediaParams,
  SearchMediaRequest,
  UpdateMediaRequest,
  MediaResponse,
  Paginated,
} from "../types";

export class MediaResource {
  constructor(private client: LangopiaClient) {}

  upload(file: File | Blob, cefrLevel: string, tags?: string): Promise<MediaResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("cefrLevel", cefrLevel);
    if (tags) formData.append("tags", tags);

    return this.client.request({
      method: "POST",
      path: "/v1/media",
      auth: "apikey",
      formData,
    });
  }

  list(params?: QueryMediaParams): Promise<Paginated<MediaResponse>> {
    return this.client.request({
      method: "GET",
      path: "/v1/media",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }

  search(data: SearchMediaRequest): Promise<MediaResponse[]> {
    return this.client.request({
      method: "POST",
      path: "/v1/media/search",
      auth: "apikey",
      body: data,
    });
  }

  uploadBulk(files: (File | Blob)[], cefrLevel: string): Promise<MediaResponse[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    formData.append("cefrLevel", cefrLevel);

    return this.client.request({
      method: "POST",
      path: "/v1/media/bulk",
      auth: "apikey",
      formData,
    });
  }

  get(id: string): Promise<MediaResponse> {
    return this.client.request({
      method: "GET",
      path: `/v1/media/${id}`,
      auth: "apikey",
    });
  }

  update(id: string, data: UpdateMediaRequest): Promise<MediaResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/v1/media/${id}`,
      auth: "apikey",
      body: data,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/v1/media/${id}`,
      auth: "apikey",
    });
  }

  retry(id: string): Promise<MediaResponse> {
    return this.client.request({
      method: "POST",
      path: `/v1/media/${id}/retry`,
      auth: "apikey",
    });
  }
}
