import type { LangopiaClient } from "../client";
import type {
  CompleteStepRequest,
  OnboardingProgressResponse,
} from "../types";

export class OnboardingResource {
  constructor(private client: LangopiaClient) {}

  getProgress(academyId: string): Promise<OnboardingProgressResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/onboarding`,
      auth: "jwt",
    });
  }

  completeStep(academyId: string, data: CompleteStepRequest): Promise<OnboardingProgressResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/onboarding/complete`,
      auth: "jwt",
      body: data,
    });
  }
}
