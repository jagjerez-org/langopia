export const PUBLISHED_SITE_RESOLVER = Symbol("PublishedSiteResolver");

export interface PublishedSiteResolver {
  schoolIdForPublishedSite(siteId: string): Promise<string | null>;
}
