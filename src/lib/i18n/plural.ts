import type { Translator } from "./translator";

/** Intl's code for a site locale (Filipino is "fil" there). */
function intlLocale(locale: string | undefined): string {
  if (!locale) return "en";
  return locale === "tl" ? "fil" : locale;
}

/** The CLDR plural category of `count` in `locale`: "one", "few", "many", "other"… */
export function pluralCategory(locale: string | undefined, count: number): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(intlLocale(locale)).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
}

/**
 * A phrase that agrees with a number: `${base}.${category}` from the
 * dictionary, where category is the number's CLDR plural category in the
 * reader's language ("1 wynik", "3 wyniki", "5 wyników"), else `${base}.other`.
 * Each dictionary defines exactly the categories its language uses (pinned by
 * tests/i18n/list-search-dictionaries.test.ts), so a form is never borrowed
 * from English. `{count}` is filled in, written the reader's way ("1,250",
 * "1.250").
 */
export function tPlural(
  t: Translator,
  locale: string | undefined,
  base: string,
  count: number,
  replacements: Record<string, string | number> = {},
): string {
  let shown = String(count);
  try {
    shown = new Intl.NumberFormat(intlLocale(locale)).format(count);
  } catch {
    // An unknown locale keeps the plain digits.
  }
  const values = { ...replacements, count: shown };
  const key = `${base}.${pluralCategory(locale, count)}`;
  const text = t(key, values);
  return text === key ? t(`${base}.other`, values) : text;
}
