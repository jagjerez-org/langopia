import { Inject } from "@nestjs/common";
import { Command, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { Block, type BlockSnapshot } from "../../../domain/model/block.vo.js";
import {
  SITE_EDITOR_REPOSITORY,
  type EditableSitePage,
  type SiteEditorRepository,
} from "../../ports/site-editor.repository.port.js";

export class SaveSitePageBlocksCommand extends Command<EditableSitePage> {
  constructor(readonly props: { pageId: string; blocks: readonly BlockSnapshot[] }) {
    super();
  }
}

@CommandHandler(SaveSitePageBlocksCommand)
export class SaveSitePageBlocksHandler implements ICommandHandler<SaveSitePageBlocksCommand> {
  constructor(
    @Inject(SITE_EDITOR_REPOSITORY) private readonly sites: SiteEditorRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(command: SaveSitePageBlocksCommand): Promise<EditableSitePage> {
    return this.uow.execute(async () => {
      const validated = command.props.blocks.map((block) => Block.from(block).toSnapshot());
      const page = await this.sites.replacePageBlocks(command.props.pageId, validated);
      if (!page) throw new NotFoundError("página editable", command.props.pageId);
      return page;
    });
  }
}
