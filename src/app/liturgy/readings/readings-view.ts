/**
 * View model for the daily readings page.
 *
 * Pure (no DB, no network): the page does the IO and hands the stored
 * DailyReading row in. The rule this module exists to enforce is that the page
 * ALWAYS computes the day's readings from the liturgical calendar engine + the
 * Lectionary tables, and only overlays the worker's stored row when that row is
 * PUBLISHED and actually carries text. A REVIEW skeleton (the worker writes one
 * for any day it cannot verify) must never shadow readings the page can compute
 * for itself.
 */

import {
  buildReadingFraming,
  type ReadingFraming,
  type ReadingSection,
} from "@/lib/content-shared/daily-readings";
import type { LiturgicalCalendarOptions } from "@/lib/content-shared/liturgical-calendar";
import {
  LECTIONARY_ATTRIBUTION,
  resolveReadings,
  type ReadingAlternative,
  type ResolvedReadingSection,
} from "@/lib/content-shared/lectionary";

export interface ReadingsViewSection extends ResolvedReadingSection {
  /** True when the text shown came from the stored PUBLISHED row, not the table. */
  overlaid: boolean;
}

export interface ReadingsMassOption {
  /** The Mass formulary key ("vigil", "night", …); null for the only Mass. */
  variant: string | null;
  label: string;
  isActive: boolean;
}

export interface ReadingsView {
  /** ISO date the page rendered (YYYY-MM-DD). */
  date: string;
  framing: ReadingFraming;
  /** Lectionary number for the "Lectionary: N" line; null when uncovered. */
  lectionaryNumber: string | null;
  /** The day label as printed in the Lectionary. */
  lectionaryLabel: string | null;
  sections: ReadingsViewSection[];
  /** The day's Mass formularies; length > 1 means the page shows a toggle. */
  masses: ReadingsMassOption[];
  activeVariant: string | null;
  /** True when at least one section carries verified Scripture text. */
  hasText: boolean;
  sourceUrl: string;
  sourceName: string;
  attribution: typeof LECTIONARY_ATTRIBUTION;
}

/** The row shape the page reads; kept structural so tests need no Prisma. */
export interface StoredReadingRow {
  status?: string | null;
  sections?: unknown;
  sourceUrl?: string | null;
  sourceName?: string | null;
}

export function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Parse an optional ?date=YYYY-MM-DD param; fall back to today (UTC). A visitor
 * with no ?date is corrected to their own local date by the client (see
 * TodayDateSync) — the server has no way to know their timezone.
 */
export function parseDateParam(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      !Number.isNaN(dt.getTime()) &&
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      return dt;
    }
  }
  return utcMidnight(new Date());
}

const MASS_LABEL: Record<string, string> = {
  vigil: "Vigil Mass",
  "extended-vigil": "Extended Vigil",
  night: "Mass during the Night",
  dawn: "Mass at Dawn",
  day: "Mass during the Day",
  chrism: "Chrism Mass",
  procession: "Procession",
  optional: "Alternative Mass",
  "year-a": "Year A readings",
};

function massLabel(variant: string | null): string {
  if (!variant) return "Mass of the day";
  return MASS_LABEL[variant] ?? variant.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function storedSections(row: StoredReadingRow | null | undefined): ReadingSection[] | null {
  if (!row || row.status !== "PUBLISHED") return null;
  const raw = row.sections;
  if (!Array.isArray(raw)) return null;
  const sections = raw.filter(
    (s): s is ReadingSection => Boolean(s) && typeof (s as ReadingSection).kind === "string",
  );
  // Only a row that actually carries text may override the computed readings.
  return sections.some((s) => typeof s.body === "string" && s.body.trim().length > 0)
    ? sections
    : null;
}

/**
 * Build everything the readings page renders for a date.
 *
 * Fail-open by construction: an uncovered day still returns the celebration,
 * the framing and the official source link, with no sections — never invented
 * readings, and never another day's.
 */
export function buildReadingsView(
  date: Date,
  opts: {
    variant?: string | null;
    row?: StoredReadingRow | null;
    calendar?: LiturgicalCalendarOptions;
  } = {},
): ReadingsView {
  const framing = buildReadingFraming(date, opts.calendar);
  const cycles = {
    sundayCycle: framing.sundayCycle as "A" | "B" | "C",
    weekdayCycle: framing.weekdayCycle as "I" | "II",
  };

  // The principal Mass first: it is what tells us which formularies the day has,
  // so an unknown ?variant can fall back to it instead of blanking the page.
  const principal = resolveReadings(framing.lectionaryKey, cycles);
  const requested =
    opts.variant && principal
      ? resolveReadings(framing.lectionaryKey, { ...cycles, variant: opts.variant })
      : null;
  const resolved = requested ?? principal;

  const stored = storedSections(opts.row);
  // The stored row belongs to the day, not to one formulary — only overlay it on
  // the principal Mass, or an alternative Mass would show the wrong text.
  const overlayable = resolved === principal ? stored : null;
  const byKind = new Map<string, ReadingSection>();
  for (const s of overlayable ?? []) byKind.set(s.kind, s);

  const sections: ReadingsViewSection[] = (resolved?.sections ?? []).map((section) => {
    const override = byKind.get(section.kind);
    const body = override?.body?.trim();
    if (!body) return { ...section, overlaid: false };
    const alternative: ReadingAlternative = {
      citation: override?.citation ?? section.citation,
      body,
      douayCitation: section.douayCitation,
      alignment: section.alignment,
      partialVerses: section.partialVerses,
      note: section.note,
    };
    return {
      ...section,
      citation: override?.citation ?? section.citation,
      body,
      // A verified stored text replaces the primary alternative only; the other
      // alternatives stay as the table computed them.
      alternatives: [alternative, ...section.alternatives.slice(1)],
      overlaid: true,
    };
  });

  const masses: ReadingsMassOption[] = (resolved?.masses ?? []).map((mass) => ({
    variant: mass.variant,
    label: massLabel(mass.variant),
    isActive: mass.variant === (resolved?.variant ?? null),
  }));

  return {
    date: framing.date,
    framing,
    lectionaryNumber: resolved?.number ?? null,
    lectionaryLabel: resolved?.label ?? null,
    sections,
    masses: masses.length > 1 ? masses : [],
    activeVariant: resolved?.variant ?? null,
    hasText: sections.some((s) => typeof s.body === "string" && s.body.length > 0),
    sourceUrl: opts.row?.sourceUrl ?? framing.sourceUrl,
    sourceName: opts.row?.sourceName ?? framing.sourceName,
    attribution: LECTIONARY_ATTRIBUTION,
  };
}
