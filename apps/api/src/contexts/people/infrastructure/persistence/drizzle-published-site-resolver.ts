import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { PublishedSiteResolver } from "../../application/ports/published-site-resolver.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

@Injectable()
export class DrizzlePublishedSiteResolver implements PublishedSiteResolver {
  constructor(private readonly drizzle: DrizzleService) {}

  async schoolIdForPublishedSite(siteId: string): Promise<string | null> {
    const [row] = await this.drizzle.connection.execute<{ school_id: string | null }>(sql`
      SELECT public.school_id_for_published_site(${siteId}::uuid) AS school_id
    `);
    return row?.school_id ?? null;
  }
}
