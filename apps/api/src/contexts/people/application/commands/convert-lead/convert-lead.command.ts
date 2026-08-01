import { Command } from "@nestjs/cqrs";

export class ConvertLeadCommand extends Command<{ leadId: string; studentId: string }> {
  constructor(
    readonly props: {
      leadId: string;
      dateOfBirth: string;
      nativeLanguage: string;
      targetLanguage: string;
      guardian?: {
        name: string;
        email: string;
        relationship: "mother" | "father" | "legal_guardian" | "other";
      } | null;
    },
  ) {
    super();
  }
}
