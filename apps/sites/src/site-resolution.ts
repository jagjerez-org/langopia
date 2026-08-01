import type { PublicSiteSummary } from "./public-site";

export type SiteResolution = PublicSiteSummary;

type ResolveSiteOptions = {
  apiUrl: string;
  request: Request;
};

export async function resolveSiteForRequest({
  apiUrl,
  request,
}: ResolveSiteOptions): Promise<SiteResolution | null> {
  if (!apiUrl || !URL.canParse(apiUrl)) {
    return null;
  }
  const host = normalizeHost(request.headers.get("host"));
  const endpoint = new URL("/api/v1/public/sites/resolve", apiUrl);
  endpoint.searchParams.set("host", host);

  const response = await fetch(endpoint.toString());

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SiteResolution;
}

function normalizeHost(hostHeader: string | null): string {
  return hostHeader?.split(":")[0] ?? "";
}
