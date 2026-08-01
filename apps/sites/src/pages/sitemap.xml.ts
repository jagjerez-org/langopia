import type { APIRoute } from "astro";

import type { PublicSiteSummary } from "../public-site";
import { buildSitemapXml, originFromRequest } from "../seo";

export const GET: APIRoute = (context) => {
  const site = context.locals.site as PublicSiteSummary;
  return new Response(
    buildSitemapXml({
      site,
      origin: originFromRequest(context.request),
    }),
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=900",
      },
    },
  );
};
