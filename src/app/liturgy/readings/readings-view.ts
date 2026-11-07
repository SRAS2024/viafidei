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
 *
 * A date can offer more than one Mass. Some are the day's own formularies
 * (Christmas during the Night, the Year A scrutiny readings); the other is its
 * evening Mass, the Vigil of the next day, which reads the next day's readings
 * under this date (?mass=vigil). Which Masses a date has is decided by
 * `eveningMass` in the calendar engine and by the tables, never by the clock.
 */

import {
  buildReadingFraming,
  isoDate,
  type ReadingFraming,
  type ReadingSection,
} from "@/lib/content-shared/daily-readings";
import {
  eveningMass,
  resolveLiturgicalDay,
  usccbReadingsUrl,
  type EveningMass,
  type LiturgicalCalendarOptions,
} from "@/lib/content-shared/liturgical-calendar";
import {
  LECTIONARY_ATTRIBUTION,
  layoutFromText,
  resolveDayReadings,
  type ReadingAlternative,
  type ResolvedReadingSection,
  type ResolvedReadings,
} from "@/lib/content-shared/lectionary";

export interface ReadingsViewSection extends ResolvedReadingSection {
  /** True when the text shown came from the stored PUBLISHED row, not the table. */
  overlaid: boolean;
}

export interface ReadingsMassOption {
  /** The Mass formulary key ("vigil", "night", …); null for the only Mass. */
  variant: string | null;
  label: string;
  /** Each Mass has its own URL, so it can be shared and navigated back to. */
  href: string;
  isActive: boolean;
}

export interface ReadingsView {
  /** ISO date the page rendered (YYYY-MM-DD). */
  date: string;
  /**
   * The day whose readings are shown: the rendered date, or in the Vigil view the
   * day it anticipates, whose cycles and Lectionary number the readings belong to.
   */
  framing: ReadingFraming;
  /** The page's title: the celebration, or "Vigil of the 32nd Sunday in Ordinary Time". */
  title: string;
  /** "Saturday, November 7, 2026", with ", evening" in the Vigil view. */
  dateLine: string;
  /** A sentence the page must say about the Mass itself, or null. */
  massNote: string | null;
  /** Lectionary number for the "Lectionary: N" line; null when uncovered. */
  lectionaryNumber: string | null;
  /** The day label as printed in the Lectionary. */
  lectionaryLabel: string | null;
  sections: ReadingsViewSection[];
  /** The Masses of this date; empty when it has one. */
  masses: ReadingsMassOption[];
  /** The formularies inside the Vigil view (Palm Sunday's Procession and Mass). */
  formularies: ReadingsMassOption[];
  activeVariant: string | null;
  /** True when this view is the evening Mass of the next day. */
  isVigil: boolean;
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

export function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const MASS_LABEL: Record<string, string> = {
  vigil: "Vigil Mass (evening before)",
  "extended-vigil": "Extended Vigil",
  night: "Mass during the Night",
  dawn: "Mass at Dawn",
  day: "Mass during the Day",
  chrism: "Chrism Mass",
  procession: "At the Procession with Palms",
  optional: "Alternative Mass",
  "year-a": "Year A readings",
};

function massLabel(variant: string | null, key: string, sundayCycle: string): string {
  if (!variant) {
    if (key === "palm-sunday") return "At the Mass";
    if (key === "holy-thursday") return "Evening Mass of the Lord's Supper";
    if (/^lent-\d-sunday$/.test(key)) return `Year ${sundayCycle} readings`;
    return "Mass of the day";
  }
  return MASS_LABEL[variant] ?? variant.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** The order the Masses of a day are celebrated in. Anything unnamed comes after. */
const MASS_ORDER: ReadonlyArray<string | null> = [
  "vigil",
  "extended-vigil",
  "night",
  "dawn",
  "chrism",
  "procession",
  null,
  "day",
  "year-a",
  "optional",
];

function massRank(variant: string | null): number {
  const rank = MASS_ORDER.indexOf(variant);
  return rank === -1 ? MASS_ORDER.length : rank;
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
 * Overlay a stored section on the computed one. A stored row is a snapshot of the
 * tables as they stood when the worker wrote it, so its text may replace the
 * computed text of the SAME reading, but a row citing a different reading is out of
 * date: a correction to the tables must not be undone by an older copy of them.
 */
function overlaySection(
  section: ResolvedReadingSection,
  stored: ReadingSection | undefined,
): ReadingsViewSection {
  const body = stored?.body?.trim();
  const sameReading =
    stored?.citation === section.citation || stored?.citation === section.alternatives[0]?.citation;
  if (!body || !sameReading) return { ...section, overlaid: false };
  const form = section.layout?.form ?? (section.kind === "PSALM" ? "verse" : "prose");
  const layout = body === section.body ? section.layout : layoutFromText(body, form);
  const alternative: ReadingAlternative = {
    citation: section.alternatives[0]?.citation ?? section.citation,
    reference: section.reference,
    body,
    layout,
    douayCitation: section.douayCitation,
    alignment: section.alignment,
    partialVerses: section.partialVerses,
    note: section.note,
  };
  return {
    ...section,
    body,
    layout,
    // A verified stored text replaces the primary alternative only; the other
    // alternatives stay as the table computed them.
    alternatives: [alternative, ...section.alternatives.slice(1)],
    overlaid: true,
  };
}

/** The date whose stored row belongs to this view, or null when none can. */
export function storedRowDate(date: Date, mass: string | null | undefined): Date | null {
  const evening = mass === "vigil" ? eveningMass(date) : null;
  if (!evening) return date;
  // The stored row is the next day's principal Mass; the Vigil's own readings are not.
  return evening.ownReadings ? null : new Date(`${evening.next.date}T00:00:00Z`);
}

function queryFor(date: string, params: { mass?: boolean; variant?: string | null }): string {
  const parts = [`date=${date}`];
  if (params.mass) parts.push("mass=vigil");
  if (params.variant) parts.push(`variant=${params.variant}`);
  return `/liturgy/readings?${parts.join("&")}`;
}

/** The readings of a Vigil view: its own formulary, or the next day's Mass. */
function resolveVigil(
  evening: EveningMass,
  variant: string | null | undefined,
): { resolved: ResolvedReadings | null; formularies: Array<string | null> } {
  const next = evening.next;
  const principal = resolveDayReadings(next);
  const all = (principal?.masses ?? []).map((m) => m.variant);
  const formularies = evening.ownReadings
    ? all.filter((v) => v === "vigil" || v === "extended-vigil")
    : all.filter((v) => v !== "vigil" && v !== "extended-vigil");
  const fallback = evening.ownReadings ? "vigil" : (formularies[0] ?? null);
  const requested = variant && formularies.includes(variant) ? variant : fallback;
  const resolved = requested ? resolveDayReadings(next, { variant: requested }) : principal;
  return { resolved, formularies };
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
    /** "vigil" asks for the evening Mass; a date without one shows its own Mass. */
    mass?: string | null;
    row?: StoredReadingRow | null;
    calendar?: LiturgicalCalendarOptions;
  } = {},
): ReadingsView {
  const iso = isoDate(date);
  const today = resolveLiturgicalDay(date, opts.calendar);
  const evening = eveningMass(date, opts.calendar);
  const isVigil = opts.mass === "vigil" && evening !== null;

  // The principal Mass first: it is what tells us which formularies the day has,
  // so an unknown ?variant can fall back to it instead of blanking the page.
  const principal = resolveDayReadings(today);
  const requested =
    !isVigil && opts.variant && principal
      ? resolveDayReadings(today, { variant: opts.variant })
      : null;
  const dayResolved = requested ?? principal;

  const vigil = isVigil ? resolveVigil(evening, opts.variant) : null;
  const resolved = vigil ? vigil.resolved : dayResolved;
  const framing = isVigil
    ? buildReadingFraming(new Date(`${evening.next.date}T00:00:00Z`), opts.calendar)
    : buildReadingFraming(date, opts.calendar);

  const stored = storedSections(opts.row);
  // The stored row belongs to the day, not to one formulary — only overlay it on
  // the principal Mass, or an alternative Mass would show the wrong text.
  const overlayable =
    resolved === principal || (vigil && !evening?.ownReadings && resolved?.variant == null)
      ? stored
      : null;
  const byKind = new Map<string, ReadingSection>();
  for (const s of overlayable ?? []) byKind.set(s.kind, s);
  const sections: ReadingsViewSection[] = (resolved?.sections ?? []).map((section) =>
    overlaySection(section, byKind.get(section.kind)),
  );

  // The day's own Masses, in the order they are celebrated.
  const activeDayVariant = !isVigil ? (dayResolved?.variant ?? null) : undefined;
  const ownMasses = (principal?.masses ?? []).length > 1 ? (principal?.masses ?? []) : [];
  const masses: ReadingsMassOption[] = [...ownMasses]
    .sort((a, b) => massRank(a.variant) - massRank(b.variant))
    .map((mass) => ({
      variant: mass.variant,
      label: massLabel(mass.variant, today.lectionaryKey, today.sundayCycle),
      href: queryFor(iso, { variant: mass.variant }),
      isActive: mass.variant === activeDayVariant,
    }));

  // The evening Mass stands beside them, unless its readings are the day's own:
  // then there is nothing to choose between.
  const sameReadings = evening ? sameCitations(principal, evening) : false;
  const showEvening = evening !== null && !sameReadings;
  if (showEvening) {
    if (masses.length === 0) {
      masses.push({
        variant: null,
        label: evening.dayLabel,
        href: queryFor(iso, {}),
        isActive: !isVigil,
      });
    }
    masses.push({
      variant: "evening",
      label: evening.label,
      href: queryFor(iso, { mass: true }),
      isActive: isVigil,
    });
  }

  const formularies: ReadingsMassOption[] =
    vigil && vigil.formularies.length > 1
      ? [...vigil.formularies]
          .sort((a, b) => massRank(a) - massRank(b))
          .map((variant) => ({
            variant,
            label:
              variant === "vigil"
                ? "Vigil Mass"
                : massLabel(variant, framing.lectionaryKey, framing.sundayCycle),
            href: queryFor(iso, { mass: true, variant }),
            isActive: variant === (resolved?.variant ?? null),
          }))
      : [];

  const holySaturday = today.temporalKey === "easter-vigil";
  return {
    date: iso,
    framing,
    title: isVigil ? evening.title : framing.celebration,
    dateLine: isVigil
      ? `${longDate(date)}, evening`
      : holySaturday
        ? `${longDate(date)}, after nightfall`
        : longDate(date),
    massNote: holySaturday
      ? "Holy Saturday has no Mass during the day. The Easter Vigil, celebrated after nightfall, is the first Mass of Easter."
      : isVigil
        ? null
        : massNoteFor(framing, date),
    lectionaryNumber: resolved?.number ?? null,
    lectionaryLabel: resolved?.label ?? null,
    sections,
    masses,
    formularies,
    activeVariant: resolved?.variant ?? null,
    isVigil,
    hasText: sections.some((s) => typeof s.body === "string" && s.body.length > 0),
    sourceUrl:
      opts.row?.sourceUrl ??
      (isVigil ? usccbReadingsUrl(new Date(`${evening.next.date}T00:00:00Z`)) : framing.sourceUrl),
    sourceName: opts.row?.sourceName ?? framing.sourceName,
    attribution: LECTIONARY_ATTRIBUTION,
  };
}

/**
 * Where the calendar says something the readings alone cannot: a day with no Mass,
 * or one where the USCCB leaves the choice of readings open.
 */
function massNoteFor(framing: ReadingFraming, date: Date): string | null {
  const key = framing.sanctoral?.key;
  if (framing.temporalKey === "good-friday") {
    return "No Mass is celebrated on Good Friday. These are the readings of the Celebration of the Passion of the Lord.";
  }
  if (key === "all-souls") {
    return "These are the readings the USCCB gives for the day. Any readings from the Masses for the Dead may be used.";
  }
  if (key === "day-of-prayer-for-the-unborn") {
    return "These are the weekday's readings. For the Day of Prayer, any readings from the Mass For Giving Thanks to God for the Gift of Human Life or the Mass For Peace and Justice may be used.";
  }
  const month = date.getUTCMonth() + 1;
  const dayOfMonth = date.getUTCDate();
  if (month === 11 && date.getUTCDay() === 4 && dayOfMonth >= 22 && dayOfMonth <= 28) {
    return "This is Thanksgiving Day in the United States. Any readings from the Mass In Thanksgiving to God may be used.";
  }
  if (month === 7 && dayOfMonth === 4 && framing.rank === "WEEKDAY") {
    return "This is Independence Day in the United States. Any readings from the Mass For the Country or a City or the Mass For Peace and Justice may be used.";
  }
  return null;
}

/** True when the next day's evening Mass reads what this date already reads. */
function sameCitations(day: ResolvedReadings | null, evening: EveningMass): boolean {
  if (!day) return false;
  const { resolved } = resolveVigil(evening, null);
  if (!resolved) return true;
  const list = (r: ResolvedReadings) => r.sections.map((s) => `${s.kind}:${s.citation}`).join("|");
  return list(day) === list(resolved);
}
