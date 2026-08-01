import { CommandBus, EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { LeadCaptured } from "../../../people/domain/events/lead.events.js";
import { StartPlacementTestCommand } from "../commands/start-placement-test/start-placement-test.command.js";

@EventsHandler(LeadCaptured)
export class OnLeadCapturedStartPlacement implements IEventHandler<LeadCaptured> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: LeadCaptured): Promise<void> {
    const payload = event.payload();
    const language = typeof payload.interestedLanguage === "string" ? payload.interestedLanguage : null;
    if (!language) return;

    await this.commands.execute(
      new StartPlacementTestCommand({
        studentProfileId: String(payload.leadId),
        language,
      }),
    );
  }
}
