import { Command } from "@nestjs/cqrs";

export class EnrolStudentCommand extends Command<{
  studentId: string;
  guardianRequired: boolean;
  currentLevel: string | null;
}> {
  constructor(
    readonly props: {
      name: string;
      email: string;
      dateOfBirth: string;
      nativeLanguage: string;
      targetLanguage: string;
      locale?: string | null;
      currentLevel?: string | null;
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
