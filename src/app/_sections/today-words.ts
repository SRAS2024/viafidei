import { civilDate, eveningMass, type MassOption } from "@/lib/content-shared/liturgical-calendar";
import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

/**
 * The words of the homepage's day block, in the reader's language. The block's parts
 * are client components, which cannot read the dictionaries, so the section looks
 * these up once on the server and hands them over.
 */
export type TodayWords = Readonly<Record<string, string>>;

/**
 * The celebrations an evening Mass may anticipate, by the calendar's key: the same
 * keys as its VIGIL_SHORT_NAMES. Any other evening is a Sunday's.
 */
const VIGIL_KEYS = [
  "all-saints",
  "all-souls",
  "ascension",
  "assumption",
  "baptism-of-the-lord",
  "christ-the-king",
  "corpus-christi",
  "epiphany",
  "holy-family",
  "immaculate-conception",
  "mary-mother-of-god",
  "nativity",
  "nativity-of-john-the-baptist",
  "palm-sunday",
  "pentecost",
  "st-joseph",
  "sts-peter-and-paul",
  "trinity-sunday",
] as const;

/** Every dictionary key the day block reads. */
export const TODAY_WORD_KEYS: readonly string[] = [
  "home.today.label",
  "facts.season",
  "home.today.sundayCycle",
  "home.today.weekdayCycle",
  "home.today.colour",
  "home.today.jubileeYear",
  "mass.evening",
  "mass.vigil.sunday",
  ...VIGIL_KEYS.map((key) => `mass.vigil.${key}`),
  "mass.ascension.wednesdayEvening",
  "mass.ascension.thursday",
  "mass.ascension.saturdayEvening",
  "mass.ascension.sunday",
];

export function todayWords(t: Translator): TodayWords {
  return Object.fromEntries(TODAY_WORD_KEYS.map((key) => [key, t(key)]));
}

/** Intl's code for a site locale (Filipino is "fil" there). */
function intlLocale(locale: Locale): string {
  return locale === "tl" ? "fil" : locale;
}

// Intl has no Latin, and would write an English date on a Latin page. These are the
// Church's own names: the weekdays as the Roman calendar numbers them, in the ablative
// of the day something falls on ("Sabbato vespere", on Saturday evening), and the
// months in the genitive a date takes ("8 Maii 2027").
const LATIN_WEEKDAYS = [
  "Dominica",
  "Feria secunda",
  "Feria tertia",
  "Feria quarta",
  "Feria quinta",
  "Feria sexta",
  "Sabbato",
] as const;

const LATIN_MONTHS = [
  "Ianuarii",
  "Februarii",
  "Martii",
  "Aprilis",
  "Maii",
  "Iunii",
  "Iulii",
  "Augusti",
  "Septembris",
  "Octobris",
  "Novembris",
  "Decembris",
] as const;

/** A day of the week in the reader's language: "Saturday", "sábado", "토요일". */
export function weekdayName(date: Date, locale: Locale): string {
  if (locale === "la") return LATIN_WEEKDAYS[date.getUTCDay()]!;
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    date,
  );
}

/**
 * The heading's date in the reader's language, in two parts that may each take a line
 * on a phone: the weekday, and the rest of the date, in the order the language puts
 * them ("Saturday," "May 8, 2027"; "2027년 5월 8일" "토요일"). `gap` is the space the
 * language puts between them, which Chinese does not.
 */
export function todayHeadingParts(
  isoDate: string,
  locale: Locale,
): { first: string; second: string; gap: string } {
  const date = civilDate(isoDate);
  if (locale === "la") {
    return {
      first: `${LATIN_WEEKDAYS[date.getUTCDay()]},`,
      second: `${date.getUTCDate()} ${LATIN_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
      gap: " ",
    };
  }
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const text = (from: number, to?: number) =>
    parts
      .slice(from, to)
      .map((part) => part.value)
      .join("");
  const at = parts.findIndex((part) => part.type === "weekday");
  if (at > 0) {
    // The weekday comes last: the date, then the day.
    const before = text(0, at);
    const first = before.trimEnd();
    return { first, second: text(at), gap: before.length > first.length ? " " : "" };
  }
  // The weekday comes first, with the comma that follows it in most languages.
  const after = parts[1]?.type === "literal" ? parts[1].value : "";
  const first = `${parts[0]?.value ?? ""}${after.trimEnd()}`;
  return { first, second: text(after ? 2 : 1).trimStart(), gap: /\s$/.test(after) ? " " : "" };
}

function fill(text: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    text,
  );
}

/**
 * What the day block calls one of the Masses a date offers, in the reader's language.
 * The calendar names them in English ("Sunday Vigil (Saturday evening)"); this says
 * the same from the same facts: which celebration the evening anticipates, on which
 * weekday, and on the Ascension's four dates, which of its two observances is meant.
 * Without the words, the calendar's own English.
 */
export function massOptionLabel(
  option: MassOption,
  date: Date,
  locale: Locale,
  words?: TodayWords,
): string {
  if (!words) return option.label;
  if (option.ascensionOnThursday) {
    const weekday = date.getUTCDay();
    const key = option.evening
      ? weekday === 3
        ? "mass.ascension.wednesdayEvening"
        : "mass.ascension.saturdayEvening"
      : weekday === 4
        ? "mass.ascension.thursday"
        : "mass.ascension.sunday";
    return words[key] ?? option.label;
  }
  if (option.evening) {
    const evening = eveningMass(date);
    const celebration = evening ? (evening.next.sanctoral?.key ?? evening.next.temporalKey) : "";
    const vigil = words[`mass.vigil.${celebration}`] ?? words["mass.vigil.sunday"];
    const template = words["mass.evening"];
    if (!vigil || !template) return option.label;
    return fill(template, { vigil, weekday: weekdayName(date, locale) });
  }
  return option.label;
}
