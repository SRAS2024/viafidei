export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "it",
  "de",
  "pt",
  "pl",
  "la",
  "tl",
  "vi",
  "ko",
  "zh",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const FALLBACK_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
  pt: "Português",
  pl: "Polski",
  la: "Latina",
  tl: "Filipino",
  vi: "Tiếng Việt",
  ko: "한국어",
  zh: "中文",
};

export function isSupportedLocale(input: string | null | undefined): input is Locale {
  if (!input) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(input);
}

export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase().split("-")[0];
  return isSupportedLocale(lower) ? lower : DEFAULT_LOCALE;
}
