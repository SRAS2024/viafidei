import type { FactItem } from "@/components/ui/FactList";
import {
  parseYear,
  patronageIsAgainst,
  saintCardDetails,
  saintLifeDates,
  saintPatronage,
} from "@/lib/content-shared/saints";
import type { Translator } from "@/lib/i18n/translator";

const MONTH =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const DAY_MONTH_YEAR = new RegExp(`^(\\d{1,2}) (${MONTH}) (\\d{3,4})$`);
const MONTH_DAY_YEAR = new RegExp(`^(${MONTH}) (\\d{1,2}), (\\d{3,4})$`);
const MONTH_YEAR = new RegExp(`^(${MONTH}) (\\d{3,4})$`);

/**
 * A pope's name as the record gives it: "Pope Francis", "Pope Pius XI", "Paul VI",
 * "Pope John-Paul II". Anything else (an Orthodox synod, a local bishop,
 * "Pre-Congregation", a stray "q") is not a pope.
 */
const POPE_NAME =
  /^(Pope\s+)?(?:(?:Saint|St\.?|Blessed|Bl\.?)\s+)?[A-Z][a-z]+(?:[ -][A-Z][a-z]+)?(\s+[IVXL]+)?$/;

/** The first papal canonization on record was in 993; an earlier "date" is a guess. */
const FIRST_PAPAL_CANONIZATION = 993;

/**
 * From 1234 canonizing belonged to the pope alone, so a later date with no pope
 * beside it is an Orthodox canonization or a confirmed cult, not the Church's act.
 */
const CANONIZATION_RESERVED_TO_POPE = 1234;

function clean(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

/** A note after a value: "(officially recognised)", "(equivalent canonization)". */
const TRAILING_NOTE = /\s*\([^)]*\)\s*$/;

/** "Paul VI" -> "Pope Paul VI"; null when the name is not a pope's. */
function popeName(raw: string): string | null {
  const name = raw.replace(TRAILING_NOTE, "");
  const m = POPE_NAME.exec(name);
  if (!m || (!m[1] && !m[2])) return null;
  return `Pope ${name.replace(/^Pope\s+/, "").replace("John-Paul", "John Paul")}`;
}

/** A date the record states outright, written the way the site writes full dates. */
function canonizationDate(raw: string): { label: string; year: number } | null {
  const date = raw.replace(TRAILING_NOTE, "").replace(/,\s*$/, "").trim();
  const circa = /^(?:c\.|ca\.?|circa)\s*(\d{3,4})$/i.exec(date);
  if (circa) return { label: `c. ${circa[1]}`, year: Number(circa[1]) };
  if (/^\d{3,4}$/.test(date)) return { label: date, year: Number(date) };
  const dmy = DAY_MONTH_YEAR.exec(date);
  if (dmy) return { label: `${Number(dmy[1])} ${dmy[2]} ${dmy[3]}`, year: Number(dmy[3]) };
  const mdy = MONTH_DAY_YEAR.exec(date);
  if (mdy) return { label: `${Number(mdy[2])} ${mdy[1]} ${mdy[3]}`, year: Number(mdy[3]) };
  const my = MONTH_YEAR.exec(date);
  if (my) return { label: `${my[1]} ${my[2]}`, year: Number(my[2]) };
  return null;
}

/**
 * The canonization line: "1 October 2000, by Pope John Paul II", or whichever of
 * the two the record has. Only a canonization the record states plainly is
 * printed. A saint still recorded as Blessed, a confirmed cult ("Cultus confirmed
 * in 1893"), an Orthodox or local act ("Russian Orthodox Church") and a date from
 * before canonizations were recorded ("304") all leave the line out: a
 * wrong-looking fact is worse than a missing one.
 */
export function saintCanonized(payload: Record<string, unknown>): string | null {
  if (clean(payload.canonizationStatus) !== "canonized") return null;
  let rawDate = clean(payload.canonizationDate);
  let rawBy = clean(payload.canonizedBy);
  if (/\bcult/i.test(`${rawDate} ${rawBy}`)) return null;
  // Some records fold the pope into the date: "25 October 1970 by Pope Paul VI",
  // "21 November 1999, Italy by Pope John Paul II".
  const folded = /^(.+?)(?:, [^,]+?)? by (Pope .+)$/.exec(rawDate);
  if (folded && !rawBy) {
    rawDate = folded[1];
    rawBy = folded[2];
  }
  const by = rawBy ? popeName(rawBy) : null;
  if (rawBy && !by) return null;
  if (!rawDate) return by ? `by ${by}` : null;
  const date = canonizationDate(rawDate);
  if (!date || date.year < FIRST_PAPAL_CANONIZATION) return null;
  if (!by && date.year >= CANONIZATION_RESERVED_TO_POPE) return null;
  const died = parseYear(payload.deathDate);
  if (died != null && date.year < died) return null;
  return by ? `${date.label}, by ${by}` : date.label;
}

/**
 * The years a saint lived, one end at a time. saintLifeDates decides what a record
 * can honestly say (a day and month dropped, "c." kept, a disputed date gone) and
 * refuses a birth after the death, in which case neither end is printed.
 */
export function saintLifeEnds(payload: Record<string, unknown>): {
  born: string | null;
  died: string | null;
} {
  if (!saintLifeDates(payload)) return { born: null, died: null };
  const end = (key: "birthDate" | "deathDate", lead: RegExp) =>
    saintLifeDates({ [key]: payload[key] })?.replace(lead, "") ?? null;
  return { born: end("birthDate", /^Born /), died: end("deathDate", /^Died /) };
}

/** A label through the dictionaries, in English until a dictionary carries it. */
function label(t: Translator, key: string, english: string): string {
  const text = t(key);
  return text === key ? english : text;
}

/**
 * A saint's facts, in the owner's order: patronage, feast day, the dates of the
 * saint's life, then the canonization. The patronage and feast come from the same
 * reading of the record as the catalogue card, so the card and the page agree. A
 * fact the record does not hold is simply left out.
 */
export function saintFactItems(payload: Record<string, unknown>, t: Translator): FactItem[] {
  const { patronages, feast } = saintCardDetails(payload);
  const patronage = saintPatronage(patronages);
  const { born, died } = saintLifeEnds(payload);
  const canonized = saintCanonized(payload);
  const items: Array<FactItem | null> = [
    patronage
      ? {
          label: patronageIsAgainst(patronage)
            ? label(t, "saints.facts.patron", "Patron")
            : t("saints.card.patronOf", { patronages: "" }).trim(),
          value: patronage,
        }
      : null,
    feast ? { label: t("saints.feastDay"), value: feast } : null,
    born ? { label: label(t, "saints.facts.born", "Born"), value: born } : null,
    died ? { label: label(t, "saints.facts.died", "Died"), value: died } : null,
    canonized ? { label: label(t, "saints.facts.canonized", "Canonized"), value: canonized } : null,
  ];
  return items.filter((item): item is FactItem => item != null);
}
