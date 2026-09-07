/**
 * Readings-source framework — how the Admin Worker acquires each day's Mass
 * readings.
 *
 * There is exactly one source in the repo:
 *   - lectionary-table (priority 100) — the committed Lectionary tables
 *     (src/lib/content-shared/lectionary/tables) resolved against the
 *     Douay-Rheims store. Offline, deterministic and trusted by construction:
 *     the citations are the Lectionary for Mass for the Dioceses of the United
 *     States and the text is public domain.
 *
 * The earlier "remote dataset" adapter (LECTIONARY_DATA_URL) is gone. It was a
 * phantom: no public dataset uses this repo's private key scheme, no URL was
 * ever configured, and nothing in the repo produced such a file — so coverage
 * could not actually grow by configuration. Coverage now grows by rebuilding
 * the tables (scripts/lectionary/build-tables.ts).
 *
 * The registry is kept so a genuinely external source can be added later (and
 * so tests can inject one); registering is the only way in.
 */

import type { ReadingSection } from "@/lib/content-shared/daily-readings";
import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";
import { resolveReadings, toStoredSections } from "@/lib/content-shared/lectionary";

export interface ResolvedFromSource {
  sections: ReadingSection[];
  /** 0..1 — share of readings whose verified text resolved. */
  confidence: number;
  /** The Lectionary number the readings came from, when the source knows it. */
  lectionaryNumber?: string | null;
}

export interface AcquiredReadings extends ResolvedFromSource {
  /** Which registered source produced these readings. */
  source: string;
}

export interface ReadingsSourceAdapter {
  name: string;
  /** Higher is tried first. */
  priority: number;
  resolve(
    date: Date,
    opts: { calendar: string; locale: string },
  ): Promise<ResolvedFromSource | null>;
}

const registry = new Map<string, ReadingsSourceAdapter>();

/** Register (or replace) a readings source. */
export function registerReadingsSource(adapter: ReadingsSourceAdapter): void {
  registry.set(adapter.name, adapter);
}

/** Registered sources, highest priority first. */
export function listReadingsSources(): ReadingsSourceAdapter[] {
  return [...registry.values()].sort((a, b) => b.priority - a.priority);
}

/** Test/diagnostic helper: forget all registered sources except the defaults. */
export function resetReadingsSources(): void {
  registry.clear();
  registerReadingsSource(lectionaryTableSource);
}

/**
 * Acquire the readings for a date from the best available source. Returns the
 * first source's result (with its name), or null when no source has the day —
 * the caller then stores the framing + the official link, never a guess.
 */
export async function acquireReadings(
  date: Date,
  opts: { calendar: string; locale: string },
): Promise<AcquiredReadings | null> {
  for (const adapter of listReadingsSources()) {
    const out = await adapter.resolve(date, opts).catch(() => null);
    if (out && out.sections.length > 0) return { ...out, source: adapter.name };
  }
  return null;
}

// ── The in-repo deterministic lectionary table (offline) ─────────────────────
const lectionaryTableSource: ReadingsSourceAdapter = {
  name: "lectionary-table",
  priority: 100,
  async resolve(date, opts) {
    if (opts.calendar !== "roman-ordinary" || opts.locale !== "en") return null;
    const day = resolveLiturgicalDay(date);
    const resolved = resolveReadings(day.lectionaryKey, {
      sundayCycle: day.sundayCycle,
      weekdayCycle: day.weekdayCycle,
    });
    if (!resolved) return null;
    return {
      // The row stores the compact section shape; the rich fields (alternatives,
      // alignment notes) are recomputed by the page from the same tables.
      sections: toStoredSections(resolved.sections),
      confidence: resolved.confidence,
      lectionaryNumber: resolved.number,
    };
  },
};
registerReadingsSource(lectionaryTableSource);

/**
 * Register the configured sources at worker startup. Nothing to configure
 * today — the table source registers itself on import — but the worker loop
 * calls this, and a future external source would be wired in here.
 */
export function initReadingsSources(): void {
  if (!registry.has(lectionaryTableSource.name)) registerReadingsSource(lectionaryTableSource);
}
