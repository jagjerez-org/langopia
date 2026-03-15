import type { AcademyPlanPeriodicity } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface CreateAcademyPlanRequest {
  name: string;
  price: number;
  currency?: string;
  periodicity?: AcademyPlanPeriodicity | string;
  limits?: AcademyPlanLimits;
}

export interface UpdateAcademyPlanRequest {
  name?: string;
  price?: number;
  currency?: string;
  periodicity?: AcademyPlanPeriodicity | string;
  limits?: AcademyPlanLimits;
}

export interface AcademyPlanLimits {
  maxIndividualClasses?: number;
  maxGroupClasses?: number;
  limitPeriod?: string;
  maxCancellations?: number;
  maxBookings?: number;
  accessLearningPath?: boolean;
  accessAiChat?: boolean;
  accessGroupClasses?: boolean;
  accessIndividualClasses?: boolean;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyPlanResponse {
  id: string;
  name: string;
  price: number;
  currency: string;
  periodicity: AcademyPlanPeriodicity;
  limits: AcademyPlanLimits;
  isActive: boolean;
  academyId: string;
  subscriptionCount?: number;
  createdAt: string;
  updatedAt: string;
}
