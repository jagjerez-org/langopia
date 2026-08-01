import type { SiteDomain } from "../model/site-domain.entity.js";

export const SITE_DOMAIN_REPOSITORY = Symbol("SiteDomainRepository");

export interface SiteDomainRepository {
  existsByHostname(hostname: string): Promise<boolean>;
  save(domain: SiteDomain): Promise<void>;
  findById(id: string): Promise<SiteDomain | null>;
  pendingBefore(now: Date): Promise<SiteDomain[]>;
  listForSchool(): Promise<SiteDomain[]>;
}
