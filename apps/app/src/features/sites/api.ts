import { api } from "../../lib/api-client.js";

export type SiteDomainStatus = "pending" | "verified" | "failed";
export type SiteDomainTlsStatus = "pending" | "issued" | "noop" | "failed";

export type SiteDomainVerification = {
  type: "TXT";
  name: string;
  value: string;
};

export type SiteDomainView = {
  id: string;
  hostname: string;
  status: SiteDomainStatus;
  isPrimary: boolean;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  tlsIssuedAt: string | null;
  tlsStatus: SiteDomainTlsStatus;
  verification: SiteDomainVerification;
};

export function listSiteDomains(): Promise<SiteDomainView[]> {
  return api.get<SiteDomainView[]>("/sites/domains");
}

export function addSiteDomain(hostname: string): Promise<SiteDomainView> {
  return api.post<SiteDomainView>("/sites/domains", { hostname });
}

export type SiteBlockType =
  | "hero"
  | "courses"
  | "teachers"
  | "pricing"
  | "testimonials"
  | "faq"
  | "contact"
  | "text";

export type SiteBlock = {
  id: string;
  type: SiteBlockType;
  props: Record<string, unknown>;
};

export type EditableSitePage = {
  id: string;
  slug: string;
  title: string;
  locale: string;
  isHome: boolean;
  published: boolean;
  blocks: SiteBlock[];
};

export type EditableTeacherOption = {
  teacherId: string;
  displayName: string;
  imageUrl: string | null;
  imageRights: boolean;
};

export type EditableSite = {
  site: {
    id: string;
    status: "draft" | "published" | "unpublished";
    primaryLocale: string;
    theme: Record<string, unknown>;
    previewUrl: string;
  };
  locales: string[];
  pages: EditableSitePage[];
  teacherOptions: EditableTeacherOption[];
};

export function getEditableSite(): Promise<EditableSite> {
  return api.get<EditableSite>("/sites/editor");
}

export function saveSitePageBlocks(pageId: string, blocks: SiteBlock[]): Promise<EditableSitePage> {
  return api.put<EditableSitePage>(`/sites/editor/pages/${pageId}/blocks`, { blocks });
}

export function publishSite(): Promise<EditableSite["site"]> {
  return api.post<EditableSite["site"]>("/sites/editor/publish");
}

export function unpublishSite(): Promise<EditableSite["site"]> {
  return api.post<EditableSite["site"]>("/sites/editor/unpublish");
}
