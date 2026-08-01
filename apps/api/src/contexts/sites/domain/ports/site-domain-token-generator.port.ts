export const SITE_DOMAIN_TOKEN_GENERATOR = Symbol("SiteDomainTokenGenerator");

export interface SiteDomainTokenGenerator {
  generate(): string;
}
