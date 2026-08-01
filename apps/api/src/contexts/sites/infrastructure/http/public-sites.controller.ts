import { Controller, Get, Header, Inject, Optional, Param, Query, Req, Res } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import type { Request, Response } from "express";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import {
  GetPublicSiteByHostQuery,
  GetPublicSitePageQuery,
} from "../../application/queries/get-site-by-host/get-public-site-by-host.handler.js";

const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

export class PublicSiteRateLimitError extends DomainError {
  readonly code = "rate_limited";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Demasiadas peticiones al sitio público. Inténtalo de nuevo en unos segundos.");
  }
}

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  now: () => number;
};

export const PUBLIC_SITE_RATE_LIMIT_OPTIONS = Symbol("PublicSiteRateLimitOptions");

@Public()
@Controller("public/sites")
export class PublicSitesController {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly rateLimit: RateLimitOptions;

  constructor(
    private readonly queries: QueryBus,
    @Optional()
    @Inject(PUBLIC_SITE_RATE_LIMIT_OPTIONS)
    rateLimit?: Partial<RateLimitOptions>,
  ) {
    this.rateLimit = {
      windowMs: rateLimit?.windowMs ?? 60_000,
      maxRequests: rateLimit?.maxRequests ?? 120,
      now: rateLimit?.now ?? Date.now,
    };
  }

  @Get("resolve")
  @Header("Cache-Control", CACHE_CONTROL)
  async resolve(@Query("host") host: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkRateLimit(clientIp(req));
    res.setHeader("Cache-Control", CACHE_CONTROL);
    return this.queries.execute(new GetPublicSiteByHostQuery({ host: host ?? "" }));
  }

  // La portada tiene slug VACÍO en la base de datos («Vacío para la
  // portada», ver packages/db/src/schema/sites.ts), y una cadena vacía no
  // cabe en el parámetro `:slug` de la ruta de abajo: sin esta ruta, la home
  // de cualquier sitio devolvía 404 aunque estuviera publicada.
  @Get(":siteId/pages")
  @Header("Cache-Control", CACHE_CONTROL)
  async homePage(
    @Param("siteId") siteId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkRateLimit(clientIp(req));
    res.setHeader("Cache-Control", CACHE_CONTROL);
    return this.queries.execute(new GetPublicSitePageQuery({ siteId, slug: "" }));
  }

  @Get(":siteId/pages/:slug")
  @Header("Cache-Control", CACHE_CONTROL)
  async page(
    @Param("siteId") siteId: string,
    @Param("slug") slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkRateLimit(clientIp(req));
    res.setHeader("Cache-Control", CACHE_CONTROL);
    return this.queries.execute(new GetPublicSitePageQuery({ siteId, slug: slug ?? "" }));
  }

  private checkRateLimit(ip: string): void {
    const now = this.rateLimit.now();
    const current = this.hits.get(ip);
    if (!current || current.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + this.rateLimit.windowMs });
      return;
    }
    if (current.count >= this.rateLimit.maxRequests) {
      throw new PublicSiteRateLimitError();
    }
    current.count += 1;
  }
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
