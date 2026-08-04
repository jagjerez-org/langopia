import type { Locale } from "./locale.js";
import type { Dictionary } from "./dictionary.js";
import { dictionary as esES } from "./es-ES.js";
import { dictionary as enGB } from "./en-GB.js";
import { dictionary as deDE } from "./de-DE.js";
import { dictionary as ptBR } from "./pt-BR.js";
import { dictionary as glES } from "./gl-ES.js";

export const DICTIONARIES: Record<Locale, Dictionary> = {
  "es-ES": esES,
  "en-GB": enGB,
  "de-DE": deDE,
  "pt-BR": ptBR,
  "gl-ES": glES,
};
