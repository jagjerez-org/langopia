import { Injectable } from "@nestjs/common";
import type { SchoolLocalePort } from "../../domain/ports/school-locale.port.js";
import { DrizzleSchoolLocaleRepository } from "../persistence/drizzle-school-locale.repository.js";

const DEFAULT_LOCALE_FALLBACK = "es-ES";
const SUPPORTED_LOCALES_FALLBACK = [DEFAULT_LOCALE_FALLBACK];

/**
 * Configuración de la escuela que afecta al catálogo.
 *
 * El acceso a datos vive en `DrizzleSchoolLocaleRepository`
 * (`infrastructure/persistence/`): este adaptador delega, no escribe SQL.
 */
@Injectable()
export class SchoolCatalogLocaleAdapter implements SchoolLocalePort {
  constructor(private readonly repository: DrizzleSchoolLocaleRepository) {}

  async defaultLocale(): Promise<string> {
    return (await this.repository.defaultLocale()) ?? DEFAULT_LOCALE_FALLBACK;
  }

  async supportedLocales(): Promise<string[]> {
    const locales = await this.repository.supportedLocales();
    return locales && locales.length > 0 ? locales : SUPPORTED_LOCALES_FALLBACK;
  }
}
