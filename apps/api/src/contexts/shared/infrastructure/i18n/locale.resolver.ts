export const SUPPORTED_LOCALES = ["es-ES", "en-GB", "de-DE", "pt-BR", "gl-ES"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es-ES";

/**
 * En qué idioma se le habla a esta persona.
 *
 * Tres fuentes, en orden de prioridad: lo que la persona eligió, lo que su
 * escuela usa por defecto, y lo que pide su navegador. Es distinto del idioma
 * que la escuela ENSEÑA, que vive en `courses.language`.
 */
export function resolveLocale(sources: {
  user: string | null | undefined;
  school: string | null | undefined;
  header: string | null | undefined;
}): Locale {
  const candidates = [
    sources.user,
    sources.school,
    ...parseAcceptLanguage(sources.header ?? ""),
  ];
  for (const candidate of candidates) {
    const found = match(candidate);
    if (found) return found;
  }
  return DEFAULT_LOCALE;
}

function match(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  // «pt» debe encontrar «pt-BR»: el idioma pesa más que la región.
  const language = value.split("-")[0]!.toLowerCase();
  return SUPPORTED_LOCALES.find((l) => l.split("-")[0]!.toLowerCase() === language) ?? null;
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag!.trim(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag.length > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}
