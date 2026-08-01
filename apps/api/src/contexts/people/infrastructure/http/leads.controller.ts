import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Public, Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { CaptureLeadCommand } from "../../application/commands/capture-lead/capture-lead.command.js";
import { ConvertLeadCommand } from "../../application/commands/convert-lead/convert-lead.command.js";
import { ListLeadsQuery } from "../../application/queries/list-leads/list-leads.handler.js";
import { CaptureLeadDto, ConvertLeadDto } from "./dto/leads.dto.js";

@Roles("owner", "admin")
@Controller("leads")
export class LeadsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  async list() {
    return this.queries.execute(new ListLeadsQuery());
  }

  @Post()
  async capture(@Body() dto: CaptureLeadDto) {
    return this.commands.execute(toCaptureCommand(dto));
  }

  @Post(":id/convert")
  @HttpCode(200)
  async convert(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.commands.execute(
      new ConvertLeadCommand({
        leadId: id,
        dateOfBirth: dto.dateOfBirth,
        nativeLanguage: dto.nativeLanguage,
        targetLanguage: dto.targetLanguage,
        guardian: dto.guardian
          ? {
              name: dto.guardian.name,
              email: dto.guardian.email,
              relationship: dto.guardian.relationship,
            }
          : null,
      }),
    );
  }
}

@Public()
@Controller("public/leads")
export class PublicLeadsController {
  constructor(private readonly commands: CommandBus) {}

  @Post()
  async capture(@Body() dto: CaptureLeadDto) {
    if (!dto.siteId) throw new BadRequestException("siteId_required");
    return this.commands.execute(toCaptureCommand(dto));
  }
}

function toCaptureCommand(dto: CaptureLeadDto): CaptureLeadCommand {
  return new CaptureLeadCommand({
    siteId: dto.siteId ?? null,
    name: dto.name,
    email: dto.email,
    phone: dto.phone ?? null,
    locale: dto.locale ?? null,
    message: dto.message ?? null,
    interestedLanguage: dto.interestedLanguage ?? null,
    declaredLevel: dto.declaredLevel ?? null,
    sourcePage: dto.sourcePage ?? null,
    sourceCampaign: dto.sourceCampaign ?? null,
    referrer: dto.referrer ?? null,
  });
}
