import type { Locale } from "./locales";
import { DEFAULT_LOCALE, FALLBACK_LOCALE } from "./locales";
import { DICTIONARIES, type Dict } from "./dictionaries";

export type { Dict } from "./dictionaries";

export function getDictionary(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? DICTIONARIES[FALLBACK_LOCALE];
}

export type Translator = (
  key: string,
  replacements?: Record<string, string | number>,
) => string;

export function createTranslator(locale: Locale): Translator {
  const dict = getDictionary(locale);
  const fallback = DICTIONARIES[DEFAULT_LOCALE];
  return function t(key, replacements) {
    const raw = dict[key] ?? fallback[key] ?? key;
    if (!replacements) return raw;
    return Object.entries(replacements).reduce(
      (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
      raw,
    );
  };
}
