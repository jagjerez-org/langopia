import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { PublishSiteCommand, UnpublishSiteCommand } from "../../application/commands/publish-site/publish-site.handler.js";
import { SaveSitePageBlocksCommand } from "../../application/commands/save-page-blocks/save-page-blocks.handler.js";
import { GetEditableSiteQuery } from "../../application/queries/get-editable-site/get-editable-site.handler.js";
import { SaveSitePageBlocksDto } from "./dto/site-editor.dto.js";

@Roles("owner", "admin")
@Controller("sites/editor")
export class SiteEditorController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  async get() {
    return this.queries.execute(new GetEditableSiteQuery());
  }

  @Put("pages/:pageId/blocks")
  async saveBlocks(@Param("pageId", ParseUUIDPipe) pageId: string, @Body() dto: SaveSitePageBlocksDto) {
    return this.commands.execute(new SaveSitePageBlocksCommand({ pageId, blocks: dto.blocks ?? [] }));
  }

  @Post("publish")
  @HttpCode(200)
  async publish() {
    return this.commands.execute(new PublishSiteCommand());
  }

  @Post("unpublish")
  @HttpCode(200)
  async unpublish() {
    return this.commands.execute(new UnpublishSiteCommand());
  }
}
