/**
 * Deterministic corroboration helpers for doctrinally-sensitive structured
 * facts.
 *
 * The hand-curated content is trusted because a human verified it. Automated
 * structured ingest needs its own accuracy guardrail for sensitive fields — a
 * saint's feast day, above all. The rule here is simple and deterministic: a
 * sensitive date claim is only published when it is ALSO stated in an
 * independent source's own text. So a feast day taken from Wikidata's structured
 * `feast day` property must additionally appear, in words, in the entity's
 * Wikipedia article before it can go live. Two independent sources agreeing —
 * no model, no inference. Anything that can't be corroborated is skipped, never
 * guessed.
 */

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** English month name for a 1–12 month number ("" when out of range). */
export function monthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface ParsedFeast {
  /** "MM-DD". */
  feastDay: string;
  feastMonth: number;
  feastDayOfMonth: number;
}

/**
 * Parse a feast day from a Wikidata `feast day` (P841) value: either a calendar
 * date item whose English label reads like "23 August" / "August 23", or a date
 * literal like "+0001-08-23T00:00:00Z" (the year is a placeholder; only the
 * month/day are meaningful). Returns null when neither yields a valid day.
 */
export function parseFeastValue(opts: { literal?: string; label?: string }): ParsedFeast | null {
  const label = opts.label?.trim();
  if (label) {
    let m = label.match(/^(\d{1,2})\s+([A-Za-z]+)/);
    if (m) {
      const day = Number(m[1]);
      const month = MONTHS[m[2].toLowerCase()];
      if (month && day >= 1 && day <= 31) return make(month, day);
    }
    m = label.match(/^([A-Za-z]+)\s+(\d{1,2})/);
    if (m) {
      const month = MONTHS[m[1].toLowerCase()];
      const day = Number(m[2]);
      if (month && day >= 1 && day <= 31) return make(month, day);
    }
  }
  const literal = opts.literal;
  if (literal) {
    const m = literal.match(/-(\d{2})-(\d{2})T/);
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return make(month, day);
    }
  }
  return null;
}

function make(month: number, day: number): ParsedFeast {
  return { feastDay: `${pad(month)}-${pad(day)}`, feastMonth: month, feastDayOfMonth: day };
}

/** Index of the earliest match of any of `patterns` in `text` (−1: none). */
function earliestMatch(patterns: RegExp[], text: string): number {
  let best = -1;
  for (const rx of patterns) {
    const m = rx.exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * Where the (month, day) feast is first stated, in words, in `text` (−1 when
 * absent). Matches "August 23", "23 August", and ordinal variants ("August
 * 23rd"). The POSITION matters for a multi-feast saint: the infobox lists the
 * current calendar date first and historical dates after it, so the ingest
 * must know which of several corroborated dates comes first — a "does it
 * appear anywhere" test cannot tell them apart.
 */
export function feastMentionIndex(month: number, day: number, text: string): number {
  const name = monthName(month).toLowerCase();
  if (!name || !text) return -1;
  const t = text.toLowerCase();
  const d = String(day);
  const after = new RegExp(`\\b${name}\\s+${d}(?:st|nd|rd|th)?\\b`);
  const before = new RegExp(`\\b${d}(?:st|nd|rd|th)?\\s+${name}\\b`);
  return earliestMatch([after, before], t);
}

/**
 * Corroboration: is the (month, day) feast stated, in words, in `text`?
 * Matches "August 23", "23 August", and ordinal variants ("August 23rd").
 */
export function feastDayInText(month: number, day: number, text: string): boolean {
  return feastMentionIndex(month, day, text) >= 0;
}

/**
 * Month names of the non-English Wikipedia editions the saint ingest can
 * corroborate against. Polish is listed in the GENITIVE ("14 lipca"), which is
 * how a date is written in running text; German accepts "14. Juli" and the
 * Austrian "Jänner"; Spanish accepts the "14 de julio" particle.
 */
const LOCALIZED_MONTHS: Record<string, string[][]> = {
  it: [
    ["gennaio"],
    ["febbraio"],
    ["marzo"],
    ["aprile"],
    ["maggio"],
    ["giugno"],
    ["luglio"],
    ["agosto"],
    ["settembre"],
    ["ottobre"],
    ["novembre"],
    ["dicembre"],
  ],
  es: [
    ["enero"],
    ["febrero"],
    ["marzo"],
    ["abril"],
    ["mayo"],
    ["junio"],
    ["julio"],
    ["agosto"],
    ["septiembre", "setiembre"],
    ["octubre"],
    ["noviembre"],
    ["diciembre"],
  ],
  fr: [
    ["janvier"],
    ["février", "fevrier"],
    ["mars"],
    ["avril"],
    ["mai"],
    ["juin"],
    ["juillet"],
    ["août", "aout"],
    ["septembre"],
    ["octobre"],
    ["novembre"],
    ["décembre", "decembre"],
  ],
  de: [
    ["januar", "jänner"],
    ["februar"],
    ["märz", "marz"],
    ["april"],
    ["mai"],
    ["juni"],
    ["juli"],
    ["august"],
    ["september"],
    ["oktober"],
    ["november"],
    ["dezember"],
  ],
  pl: [
    ["stycznia", "styczeń"],
    ["lutego", "luty"],
    ["marca", "marzec"],
    ["kwietnia", "kwiecień"],
    ["maja", "maj"],
    ["czerwca", "czerwiec"],
    ["lipca", "lipiec"],
    ["sierpnia", "sierpień"],
    ["września", "wrzesień"],
    ["października", "październik"],
    ["listopada", "listopad"],
    ["grudnia", "grudzień"],
  ],
};

/** Languages `feastDayInTextLocalized` understands (plus "en"). */
export const CORROBORATION_LANGS = ["en", ...Object.keys(LOCALIZED_MONTHS)];

/**
 * Corroboration in a non-English Wikipedia edition: is the (month, day) feast
 * stated, in words, in `text` written in `lang`? Falls back to the English
 * matcher for "en" and returns false for an unsupported language — never
 * guesses from a language it can't read.
 */
export function feastDayInTextLocalized(
  month: number,
  day: number,
  text: string,
  lang: string,
): boolean {
  return feastMentionIndexLocalized(month, day, text, lang) >= 0;
}

/**
 * Localized counterpart of `feastMentionIndex`: where the feast is first
 * stated in `text` written in `lang` (−1 when absent or the language is not
 * supported). "en" delegates to the English matcher.
 */
export function feastMentionIndexLocalized(
  month: number,
  day: number,
  text: string,
  lang: string,
): number {
  if (lang === "en") return feastMentionIndex(month, day, text);
  const months = LOCALIZED_MONTHS[lang]?.[month - 1];
  if (!months || !text) return -1;
  const t = text.toLowerCase();
  const d = String(day);
  const patterns: RegExp[] = [];
  for (const name of months) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // "14 luglio", "14 de julio", "14. Juli", "1er juillet", "14 lipca".
    patterns.push(
      new RegExp(`(?<!\\d)${d}(?:\\.|er|º|°)?(?:\\s+de)?\\s+${escaped}(?![a-zà-ž])`, "u"),
    );
    // "Juli 14" is unusual in these languages but harmless to accept.
    patterns.push(new RegExp(`(?<![a-zà-ž])${escaped}\\s+${d}(?!\\d)`, "u"));
  }
  return earliestMatch(patterns, t);
}

/**
 * Map a Wikidata `canonization status` (P411) LABEL to the schema enum.
 *
 * Retained for callers that only have a label; the SAINT ingest itself no
 * longer uses it — it maps by QID (`saint-facts.ts`) because label matching
 * turned every "…saint" item (Orthodox, Anglican, Coptic, folk) into a
 * Catholic `canonized`. Order matters — "Servant of God", "Venerable", and
 * "Blessed" are checked before the broad "saint"/"canonized". Returns null for
 * an unknown label so the caller skips rather than guesses.
 */
export function mapCanonizationStatus(
  label: string,
): "canonized" | "beatified" | "venerable" | "servant_of_god" | null {
  const l = label.toLowerCase();
  if (l.includes("servant of god")) return "servant_of_god";
  if (l.includes("venerable")) return "venerable";
  if (l.includes("blessed") || l.includes("beatif")) return "beatified";
  if (l.includes("saint") || l.includes("canoniz")) return "canonized";
  return null;
}
