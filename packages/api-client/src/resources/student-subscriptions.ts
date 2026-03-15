import type { LangopiaClient } from "../client";
import type {
  CreateSubscriptionRequest,
  PublicSubscribeRequest,
  StudentSubscriptionResponse,
  PublicSubscribeResponse,
} from "../types";

export class StudentSubscriptionsResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string): Promise<StudentSubscriptionResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/subscriptions`,
      auth: "jwt",
    });
  }

  create(academyId: string, data: CreateSubscriptionRequest): Promise<StudentSubscriptionResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/subscriptions`,
      auth: "jwt",
      body: data,
    });
  }

  get(academyId: string, id: string): Promise<StudentSubscriptionResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/subscriptions/${id}`,
      auth: "jwt",
    });
  }

  cancel(academyId: string, id: string): Promise<StudentSubscriptionResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/subscriptions/${id}/cancel`,
      auth: "jwt",
    });
  }

  publicSubscribe(slug: string, data: PublicSubscribeRequest): Promise<PublicSubscribeResponse> {
    return this.client.request({
      method: "POST",
      path: `/public/academy/${slug}/subscribe`,
      auth: "none",
      body: data,
    });
  }
}
