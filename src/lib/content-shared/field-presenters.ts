/**
 * Field presenters — how a raw payload key/value becomes something a reader
 * can actually read.
 *
 * The generic detail renderer used to print the key ("durationMinutes" →
 * heading "Duration Minutes") and `String(value)` ("20", "04-19",
 * "[object Object]"). This module is the single place where a payload field
 * turns into a human label and a human value, so every detail page speaks the
 * same language and no page can leak a camelCase key, a raw enum value, or a
 * JSON dump onto the site.
 *
 * Two rules matter more than tidiness:
 *   1. Never invent content. A value we cannot present is HIDDEN, not
 *      stringified — a wrong-looking fact is worse than a missing section on a
 *      site whose whole point is Catholic accuracy.
 *   2. Never guess units. Only fields whose unit is in their name
 *      (`durationMinutes`) get a unit-bearing sentence.
 */
import { GUIDE_KIND_LABELS } from "./guide-categories";

/* ------------------------------------------------------------------ labels */

/**
 * Explicit labels for payload keys whose auto-humanised form is wrong or
 * clumsy. Anything not listed falls back to `humanizeKey` (camelCase split +
 * sentence case), which is right for the long tail (`keyThemes` → "Key
 * themes").
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  durationMinutes: "Duration",
  durationDays: "Duration",
  feastDay: "Feast day",
  feastDate: "Feast day",
  whatYouNeed: "What you need",
  whenToPray: "When to pray",
  howToPractice: "How to practice",
  practiceInstructions: "How to practice",
  practiceText: "How to practice",
  bodyExcerpt: "Excerpt",
  theologicalOverview: "What the Church teaches",
  theologicalSignificance: "Why it matters",
  papacyStart: "Papacy began",
  papacyEnd: "Papacy ended",
  birthName: "Birth name",
  doctorTitle: "Doctor title",
  typicalStartDate: "Usually begun",
  intentionTheme: "Intention",
  keyThemes: "Key themes",
  relatedPrayers: "Related prayers",
  relatedDevotions: "Related devotions",
  relatedPractices: "Related practices",
  relatedSaints: "Related saints",
  officialPrayer: "Official text",
  patronages: "Patronage",
  patronage: "Patronage",
  occasions: "When it is prayed",
  citations: "Sources",
};

/** camelCase / snake_case / kebab-case → "Sentence case words". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** The heading a payload field is shown under. Never the raw key. */
export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? humanizeKey(key);
}

/* ------------------------------------------------------------------ values */

const MONTHS = [
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

/**
 * "04-19" → "April 19"; "2026-04-19" → "April 19, 2026".
 * Returns null when the string is not one of those two shapes, so ordinary
 * prose ("The Tuesday after Pentecost") is left exactly as written.
 */
export function formatFeastDay(value: string): string | null {
  const mmdd = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (mmdd) {
    const month = MONTHS[Number(mmdd[1]) - 1];
    const day = Number(mmdd[2]);
    if (month && day >= 1 && day <= 31) return `${month} ${day}`;
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) {
    const month = MONTHS[Number(iso[2]) - 1];
    const day = Number(iso[3]);
    if (month && day >= 1 && day <= 31) return `${month} ${day}, ${iso[1]}`;
    return null;
  }
  return null;
}

/** 20 → "About 20 minutes"; 1 → "About 1 minute"; 90 → "About 1 hour 30 minutes". */
export function formatDurationMinutes(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  if (whole < 60) return `About ${whole} minute${whole === 1 ? "" : "s"}`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0
    ? `About ${hourPart}`
    : `About ${hourPart} ${rest} minute${rest === 1 ? "" : "s"}`;
}

/**
 * Payload keys whose values are closed enums stored in machine form. Only
 * these get enum-humanising, so a genuine one-word sentence elsewhere is never
 * rewritten.
 */
const ENUM_KEYS = new Set([
  "kind",
  "category",
  "saintType",
  "prayerType",
  "devotionType",
  "practiceKind",
  "liturgyType",
  "documentType",
  "sacramentKey",
  "riteKey",
  "riteFamily",
  "designation",
  "parishClass",
  // Status enums arrive UPPER_SNAKE from the database ("APPROVED",
  // "VATICAN_APPROVED"); printed raw they shout at the reader.
  "approvedStatus",
  "approvalStatus",
  "canonizationStatus",
  "authorityLevel",
  "movableFeast",
  "season",
]);

/** "lent_preparation" → "Lent"; "anointing_of_the_sick" → "Anointing of the sick". */
export function formatEnumValue(key: string, value: string): string {
  const raw = value.trim();
  if (key === "kind" && GUIDE_KIND_LABELS[raw]) return GUIDE_KIND_LABELS[raw];
  // Only fold machine-shaped tokens (one word, or words joined by _ / -);
  // anything with spaces is already prose and is left exactly as written.
  if (!/^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*$/.test(raw)) return raw;
  return humanizeKey(raw);
}

/** A presented value, ready for a renderer. Recursive so nesting stays typed. */
export type PresentedValue =
  | { kind: "text"; text: string; multiline: boolean }
  | { kind: "list"; items: PresentedValue[]; ordered: boolean }
  | { kind: "pairs"; pairs: Array<{ label: string; value: PresentedValue }> };

/** Objects nested deeper than this are structure, not content — hidden. */
const MAX_DEPTH = 2;

function text(value: string): PresentedValue {
  return { kind: "text", text: value, multiline: value.includes("\n") };
}

/**
 * Turn one payload value into something renderable, or `null` when it cannot
 * be presented honestly (booleans, functions, empty collections, objects too
 * deep or with no presentable leaves). Callers render `null` as "no section",
 * never as an empty heading.
 */
export function presentValue(key: string, value: unknown, depth = 0): PresentedValue | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (key === "feastDay" || key === "feastDate") {
      const formatted = formatFeastDay(trimmed);
      return text(formatted ?? trimmed);
    }
    if (ENUM_KEYS.has(key)) return text(formatEnumValue(key, trimmed));
    // Keep the original (untrimmed) string so deliberate indentation in prayer
    // and step text survives.
    return text(value.replace(/\s+$/, ""));
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (key === "durationMinutes") {
      const formatted = formatDurationMinutes(value);
      return formatted ? text(formatted) : null;
    }
    if (key === "durationDays") {
      const whole = Math.round(value);
      return whole > 0 ? text(`${whole} day${whole === 1 ? "" : "s"}`) : null;
    }
    return text(String(value));
  }

  // Booleans are flags, not content. A section reading "Yes" tells a reader
  // nothing, so they are hidden rather than printed.
  if (typeof value === "boolean") return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const items = value
      .map((el) => presentValue(key, el, depth + 1))
      .filter((v): v is PresentedValue => v != null);
    if (items.length === 0) return null;
    // A list of objects reads as a sequence (novena days, mystery sets); a list
    // of strings reads as a set of items.
    const ordered = items.some((v) => v.kind === "pairs");
    return { kind: "list", items, ordered };
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return null;
    const pairs: Array<{ label: string; value: PresentedValue }> = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const presented = presentValue(k, v, depth + 1);
      if (presented) pairs.push({ label: fieldLabel(k), value: presented });
    }
    if (pairs.length === 0) return null;
    return { kind: "pairs", pairs };
  }

  return null;
}

/** Longest single-line string still shown as a chip rather than a bullet. */
export const CHIP_MAX_LENGTH = 32;

/**
 * Whether a presented list should render as chips (short tags — patronages,
 * what-you-need) rather than a bulleted list. Chips only ever hold short,
 * single-line text so they cannot swallow a paragraph.
 */
export function isChipList(value: PresentedValue): boolean {
  if (value.kind !== "list") return false;
  return value.items.every(
    (item) => item.kind === "text" && !item.multiline && item.text.length <= CHIP_MAX_LENGTH,
  );
}
