import type { LeadId } from "../model/identifiers.js";
import type { Lead } from "../model/lead.aggregate.js";

export interface LeadRepository {
  find(id: LeadId): Promise<Lead | null>;
  save(lead: Lead): Promise<void>;
  markColdCandidates(cutoff: Date): Promise<number>;
}

export const LEAD_REPOSITORY = Symbol("LeadRepository");
