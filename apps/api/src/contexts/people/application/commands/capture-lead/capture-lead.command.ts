import { Command } from "@nestjs/cqrs";

export class CaptureLeadCommand extends Command<{ leadId: string; status: string }> {
  constructor(
    readonly props: {
      siteId?: string | null;
      name: string;
      email: string;
      phone?: string | null;
      locale?: string | null;
      message?: string | null;
      interestedLanguage?: string | null;
      declaredLevel?: string | null;
      sourcePage?: string | null;
      sourceCampaign?: string | null;
      referrer?: string | null;
    },
  ) {
    super();
  }
}
