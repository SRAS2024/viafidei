import { cookies, headers } from "next/headers";
import { isSupportedLocale, type Locale } from "./locales";
import { createTranslator, getDictionary } from "./translator";
import { LOCALE_COOKIE_NAME } from "./cookie";
import { negotiateLocale } from "./negotiate";
import { rememberRequestLocale } from "./request-locale";

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
  const cookieStore = await cookies();
  const override = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale =
    override && isSupportedLocale(override)
      ? override
      : negotiateLocale((await headers()).get("accept-language"));
  rememberRequestLocale(locale);
  return locale;
}

export async function getTranslator() {
  const locale = await getLocale();
  return { t: createTranslator(locale), locale, dict: getDictionary(locale) };
}
