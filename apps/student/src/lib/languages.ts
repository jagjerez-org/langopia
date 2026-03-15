export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: "english", name: "English", flag: "🇬🇧" },
  { code: "spanish", name: "Español", flag: "🇪🇸" },
  { code: "french", name: "Français", flag: "🇫🇷" },
  { code: "german", name: "Deutsch", flag: "🇩🇪" },
  { code: "italian", name: "Italiano", flag: "🇮🇹" },
  { code: "portuguese", name: "Português", flag: "🇧🇷" },
  { code: "japanese", name: "日本語", flag: "🇯🇵" },
  { code: "chinese", name: "中文", flag: "🇨🇳" },
  { code: "korean", name: "한국어", flag: "🇰🇷" },
];

export const LANGUAGE_MAP = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguageFlag(code: string | null | undefined): string {
  if (!code) return "🌍";
  return LANGUAGE_MAP.get(code.toLowerCase())?.flag ?? "🌍";
}

export function getLanguageName(code: string | null | undefined): string {
  if (!code) return code ?? "";
  return LANGUAGE_MAP.get(code.toLowerCase())?.name ?? code;
}
