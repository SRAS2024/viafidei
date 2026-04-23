import { cookies, headers } from "next/headers";
import Negotiator from "negotiator";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, normalizeLocale, type Locale } from "./locales";
import { createTranslator, getDictionary } from "./messages";

const LOCALE_COOKIE = "vf_locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = cookies();
  const override = cookieStore.get(LOCALE_COOKIE)?.value;
  if (override && isSupportedLocale(override)) return override;

  const headerList = headers();
  const accept = headerList.get("accept-language");
  if (!accept) return DEFAULT_LOCALE;

  try {
    const negotiator = new Negotiator({ headers: { "accept-language": accept } });
    const wanted = negotiator.languages();
    for (const raw of wanted) {
      const normalized = normalizeLocale(raw);
      if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) return normalized;
    }
  } catch {
    // fall through
  }

  return DEFAULT_LOCALE;
}

export async function getTranslator() {
  const locale = await getLocale();
  return { t: createTranslator(locale), locale, dict: getDictionary(locale) };
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE;
