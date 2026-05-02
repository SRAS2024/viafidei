import { cookies, headers } from "next/headers";
import { isSupportedLocale, type Locale } from "./locales";
import { createTranslator, getDictionary } from "./translator";
import { LOCALE_COOKIE_NAME } from "./cookie";
import { negotiateLocale } from "./negotiate";

export { LOCALE_COOKIE_NAME } from "./cookie";

export async function getLocale(): Promise<Locale> {
  const override = cookies().get(LOCALE_COOKIE_NAME)?.value;
  if (override && isSupportedLocale(override)) return override;
  return negotiateLocale(headers().get("accept-language"));
}

export async function getTranslator() {
  const locale = await getLocale();
  return { t: createTranslator(locale), locale, dict: getDictionary(locale) };
}
