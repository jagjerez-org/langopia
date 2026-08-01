import { Inject } from "@nestjs/common";
import { Command, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SITE_EDITOR_REPOSITORY,
  type EditableSite,
  type SiteEditorRepository,
} from "../../ports/site-editor.repository.port.js";

export class PublishSiteCommand extends Command<EditableSite["site"]> {}
export class UnpublishSiteCommand extends Command<EditableSite["site"]> {}

@CommandHandler(PublishSiteCommand)
export class PublishSiteHandler implements ICommandHandler<PublishSiteCommand> {
  constructor(
    @Inject(SITE_EDITOR_REPOSITORY) private readonly sites: SiteEditorRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<EditableSite["site"]> {
    return this.uow.execute(async () => {
      const site = await this.sites.publishSite();
      if (!site) throw new NotFoundError("sitio editable", "escuela activa");
      return site;
    });
  }
}

@CommandHandler(UnpublishSiteCommand)
export class UnpublishSiteHandler implements ICommandHandler<UnpublishSiteCommand> {
  constructor(
    @Inject(SITE_EDITOR_REPOSITORY) private readonly sites: SiteEditorRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<EditableSite["site"]> {
    return this.uow.execute(async () => {
      const site = await this.sites.unpublishSite();
      if (!site) throw new NotFoundError("sitio editable", "escuela activa");
      return site;
    });
  }
}
