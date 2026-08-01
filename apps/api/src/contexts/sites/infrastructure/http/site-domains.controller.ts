import { Body, Controller, Get, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AddDomainCommand } from "../../application/commands/add-domain/add-domain.handler.js";
import { ListDomainsQuery } from "../../application/queries/list-domains/list-domains.handler.js";
import { AddSiteDomainDto } from "./dto/site-domain.dto.js";

@Roles("owner", "admin")
@Controller("sites/domains")
export class SiteDomainsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  async list() {
    return this.queries.execute(new ListDomainsQuery());
  }

  @Post()
  async add(@Body() dto: AddSiteDomainDto) {
    return this.commands.execute(new AddDomainCommand({ hostname: dto.hostname }));
  }
}
