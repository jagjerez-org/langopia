import { Command } from "@nestjs/cqrs";
import type { SchoolSettingsResult } from "../../queries/get-school-settings/get-school-settings.handler.js";

/**
 * Edición parcial (PATCH): un campo ausente en `props` no se toca. La forma
 * de `SchoolSettingsResult` no encaja del todo con `props` a propósito —
 * `status`/`trialEndsAt`/`supportedLocales` no son parámetros de entrada,
 * los decide el propio manejador o quedan tal cual estaban.
 */
export class UpdateSchoolSettingsCommand extends Command<SchoolSettingsResult> {
  constructor(
    readonly props: {
      name?: string;
      defaultLocale?: string;
    },
  ) {
    super();
  }
}
