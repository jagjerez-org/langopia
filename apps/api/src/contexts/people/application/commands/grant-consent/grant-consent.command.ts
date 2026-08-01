import { Command } from "@nestjs/cqrs";
import type { ConsentKind } from "../../../domain/model/consent.vo.js";

export class GrantConsentCommand extends Command<{
  studentId: string;
  kind: ConsentKind;
  granted: boolean;
}> {
  constructor(
    readonly props: {
      studentId: string;
      kind: ConsentKind;
      /** Quién firma: el propio alumno adulto, o su tutor legal si es menor. */
      grantedByMembershipId: string;
    },
  ) {
    super();
  }
}
