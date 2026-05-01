import Negotiator from "negotiator";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale, type Locale } from "./locales";

export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  try {
    const negotiator = new Negotiator({ headers: { "accept-language": acceptLanguage } });
    const wanted = negotiator.languages();
    for (const raw of wanted) {
      const normalized = normalizeLocale(raw);
      if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) return normalized;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_LOCALE;
}
