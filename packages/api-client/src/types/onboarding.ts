import type { OnboardingStep } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface CompleteStepRequest {
  step: OnboardingStep | string;
}

// ─── Responses ──────────────────────────────────────

export interface OnboardingProgressResponse {
  step: OnboardingStep;
  completedAt: string;
}
