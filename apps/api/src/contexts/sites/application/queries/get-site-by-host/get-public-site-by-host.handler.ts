import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { Block, SiteBlockType, type BlockSnapshot } from "../../../domain/model/block.vo.js";
import {
  PUBLIC_SITE_READ_MODEL,
  type PublicSitePage,
  type PublicSiteReadModel,
  type PublicSiteSummary,
} from "../../ports/public-site-read-model.port.js";

export class GetPublicSiteByHostQuery extends Query<PublicSiteSummary> {
  constructor(readonly props: { host: string }) {
    super();
  }
}

export class GetPublicSitePageQuery extends Query<PublicSitePage> {
  constructor(readonly props: { siteId: string; slug: string }) {
    super();
  }
}

@QueryHandler(GetPublicSiteByHostQuery)
export class GetPublicSiteByHostHandler implements IQueryHandler<GetPublicSiteByHostQuery> {
  constructor(@Inject(PUBLIC_SITE_READ_MODEL) private readonly readModel: PublicSiteReadModel) {}

  async execute(query: GetPublicSiteByHostQuery): Promise<PublicSiteSummary> {
    const host = normalizeHost(query.props.host);
    const site = await this.readModel.resolveSiteByHost(host);
    if (!site) throw new NotFoundError("sitio público", host);
    return site;
  }
}

@QueryHandler(GetPublicSitePageQuery)
export class GetPublicSitePageHandler implements IQueryHandler<GetPublicSitePageQuery> {
  constructor(@Inject(PUBLIC_SITE_READ_MODEL) private readonly readModel: PublicSiteReadModel) {}

  async execute(query: GetPublicSitePageQuery): Promise<PublicSitePage> {
    const page = await this.readModel.getPublishedPage({
      siteId: query.props.siteId,
      slug: normalizeSlug(query.props.slug),
    });
    if (!page) throw new NotFoundError("página pública", query.props.slug);
    return {
      page: page.page,
      blocks: page.blocks.map(sanitizePublicBlock),
    };
  }
}

function normalizeHost(value: string): string {
  const host = value.trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) throw new NotFoundError("sitio público", "");
  return host;
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function sanitizePublicBlock(snapshot: BlockSnapshot): BlockSnapshot {
  const block = Block.from(snapshot);
  if (block.type === SiteBlockType.Teachers) {
    return Block.teachers({
      id: block.id,
      teachers: block.visibleTeachers,
    }).toSnapshot();
  }
  if (block.type === SiteBlockType.Testimonials) {
    return Block.testimonials({
      id: block.id,
      testimonials: block.publicTestimonials,
    }).toSnapshot();
  }
  return block.toSnapshot();
}
