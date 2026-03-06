import type { StudentSubscriptionStatus } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface CreateSubscriptionRequest {
  studentId: string;
  academyPlanId: string;
}

export interface PublicSubscribeRequest {
  studentEmail: string;
  studentName: string;
  academyPlanId: string;
}

// ─── Responses ──────────────────────────────────────

export interface StudentSubscriptionResponse {
  id: string;
  studentId: string;
  academyPlanId: string;
  academyId: string;
  status: StudentSubscriptionStatus;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: string; name: string | null; email: string };
  plan?: { id: string; name: string; price: number; currency: string };
}

export interface PublicSubscribeResponse {
  checkoutUrl: string;
}
