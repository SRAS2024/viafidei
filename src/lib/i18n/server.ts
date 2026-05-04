import { cookies, headers } from "next/headers";
import { isSupportedLocale, type Locale } from "./locales";
import { createTranslator, getDictionary } from "./translator";
import { LOCALE_COOKIE_NAME } from "./cookie";
import { negotiateLocale } from "./negotiate";

export { LOCALE_COOKIE_NAME } from "./cookie";

/**
 * Resolve the active locale, honoring this priority order:
 *  1. Locale cookie (`vf_locale`) — set when the user manually picks one.
 *     For signed-in users this is kept in sync with their saved language.
 *  2. `Accept-Language` negotiation — first-visit / device language.
 *  3. Default English fallback.
 *
 * The signed-in user's saved profile language is persisted to the cookie
 * elsewhere (see /api/settings/locale and createUser), so this function
 * stays free of database lookups and remains safe in static rendering.
 */
export async function getLocale(): Promise<Locale> {
  const override = cookies().get(LOCALE_COOKIE_NAME)?.value;
  if (override && isSupportedLocale(override)) return override;
  return negotiateLocale(headers().get("accept-language"));
}

export async function getTranslator() {
  const locale = await getLocale();
  return { t: createTranslator(locale), locale, dict: getDictionary(locale) };
}
