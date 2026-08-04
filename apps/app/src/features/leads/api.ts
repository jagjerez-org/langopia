import { api } from "../../lib/api-client.js";

export type LeadStatus =
  | "new"
  | "placement_sent"
  | "placement_done"
  | "contacted"
  | "converted"
  | "cold"
  | "discarded";

export type LeadFunnelView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: LeadStatus;
  interestedLanguage: string | null;
  declaredLevel: string | null;
  placementLevel: string | null;
  placementScore: number | null;
  sourcePage: string | null;
  sourceCampaign: string | null;
  createdAt: string;
  lastContactedAt: string | null;
};

export function listLeads(): Promise<LeadFunnelView[]> {
  return api.get<LeadFunnelView[]>("/leads");
}
