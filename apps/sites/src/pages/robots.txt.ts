import type { APIRoute } from "astro";

import { buildRobotsTxt, originFromRequest } from "../seo";

export const GET: APIRoute = (context) =>
  new Response(buildRobotsTxt(originFromRequest(context.request)), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
