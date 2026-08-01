import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SITE_EDITOR_REPOSITORY,
  type EditableSite,
  type SiteEditorRepository,
} from "../../ports/site-editor.repository.port.js";

export class GetEditableSiteQuery extends Query<EditableSite> {}

@QueryHandler(GetEditableSiteQuery)
export class GetEditableSiteHandler implements IQueryHandler<GetEditableSiteQuery> {
  constructor(
    @Inject(SITE_EDITOR_REPOSITORY) private readonly sites: SiteEditorRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<EditableSite> {
    return this.uow.read(async () => {
      const site = await this.sites.getEditableSite(previewBaseUrl());
      if (!site) throw new NotFoundError("sitio editable", "escuela activa");
      return site;
    });
  }
}

function previewBaseUrl(): string {
  return (process.env.SITE_PREVIEW_URL ?? "http://localhost:4321").replace(/\/+$/, "");
}
