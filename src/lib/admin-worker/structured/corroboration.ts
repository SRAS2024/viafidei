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

/**
 * Corroboration: is the (month, day) feast stated, in words, in `text`?
 * Matches "August 23", "23 August", and ordinal variants ("August 23rd").
 */
export function feastDayInText(month: number, day: number, text: string): boolean {
  const name = monthName(month).toLowerCase();
  if (!name || !text) return false;
  const t = text.toLowerCase();
  const d = String(day);
  const after = new RegExp(`\\b${name}\\s+${d}(?:st|nd|rd|th)?\\b`);
  const before = new RegExp(`\\b${d}(?:st|nd|rd|th)?\\s+${name}\\b`);
  return after.test(t) || before.test(t);
}

/**
 * Map a Wikidata `canonization status` (P411) label to the schema enum.
 * Order matters — "Servant of God", "Venerable", and "Blessed" are checked
 * before the broad "saint"/"canonized". Returns null for an unknown label so
 * the caller skips rather than guesses.
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
