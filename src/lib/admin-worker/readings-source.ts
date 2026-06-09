/**
 * Readings-source framework — the Admin Worker's pluggable ability to acquire
 * each day's Mass readings from the best available source, so it can finish
 * and manage the lectionary itself.
 *
 * Sources are tried in priority order; the first that yields readings wins:
 *   1. lectionary-table (priority 100) — the in-repo deterministic table
 *      (Douay-Rheims), offline + always trusted. Covers the principal days.
 *   2. remote-dataset (priority 50) — an authoritative lectionary dataset the
 *      operator points the worker at via LECTIONARY_DATA_URL. Fetched once and
 *      cached in-process; this is how the worker fills the *rest* of the year
 *      in production (where it has network), keyed on the same lectionaryKey so
 *      a finite dataset serves every year.
 *
 * The worker stores whatever it acquires into DailyReading (see
 * daily-readings.ts) and re-verifies/self-corrects on every backfill scan, so
 * adding a source automatically completes coverage with no code change.
 *
 * Network is gated: the remote source is only registered when its URL is set,
 * and it no-ops under ADMIN_WORKER_SKIP_NETWORK, so tests + offline runs use
 * the deterministic table alone.
 */

import type { ReadingKind, ReadingSection } from "@/lib/content-shared/daily-readings";
import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";
import { resolveReadings } from "@/lib/content-shared/lectionary";

export interface ResolvedFromSource {
  sections: ReadingSection[];
  /** 0..1 — share of readings whose verified text resolved. */
  confidence: number;
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

const READING_KINDS: ReadonlySet<string> = new Set<ReadingKind>([
  "FIRST_READING",
  "PSALM",
  "SECOND_READING",
  "ACCLAMATION",
  "GOSPEL",
  "OTHER",
]);

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
 * first source's result (with its name), or null when no source has the day.
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

// ── Source 1: the in-repo deterministic lectionary table (offline) ───────────
const lectionaryTableSource: ReadingsSourceAdapter = {
  name: "lectionary-table",
  priority: 100,
  async resolve(date, opts) {
    if (opts.calendar !== "roman-ordinary" || opts.locale !== "en") return null;
    const day = resolveLiturgicalDay(date);
    return resolveReadings(day.lectionaryKey, day.sundayCycle);
  },
};
registerReadingsSource(lectionaryTableSource);

// ── Source 2: a configurable remote lectionary dataset (runtime) ─────────────

/**
 * Validate + normalise a fetched lectionary dataset into a lookup keyed by
 * `lectionaryKey` or `lectionaryKey|cycle`. Pure + strict: malformed entries
 * are dropped (never trusted), so a bad feed degrades to fewer covered days,
 * never to wrong readings. Expected shape:
 *   { entries: { "<key>": [ { kind, label, citation, body? }, ... ] } }
 */
export function ingestLectionaryDataset(raw: unknown): Record<string, ReadingSection[]> {
  const out: Record<string, ReadingSection[]> = {};
  const entries = (raw as { entries?: unknown } | null)?.entries;
  if (!entries || typeof entries !== "object") return out;
  for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const sections: ReadingSection[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.kind !== "string" || !READING_KINDS.has(rec.kind)) continue;
      const citation = typeof rec.citation === "string" ? rec.citation : null;
      const body = typeof rec.body === "string" && rec.body.trim().length > 0 ? rec.body : null;
      if (!citation && !body) continue; // an empty section is not useful
      sections.push({
        kind: rec.kind as ReadingKind,
        label: typeof rec.label === "string" ? rec.label : rec.kind,
        citation,
        body,
      });
    }
    if (sections.length > 0) out[key] = sections;
  }
  return out;
}

type DatasetLoader = (url: string) => Promise<unknown>;

async function defaultDatasetLoader(url: string): Promise<unknown> {
  // Gated: never reach the network in tests / offline runs.
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let datasetCache: Record<string, ReadingSection[]> | null = null;
let datasetLoadedFor: string | null = null;

/**
 * Configure the worker to ingest an authoritative lectionary dataset from a
 * URL (fetched once per process, cached). Keyed on lectionaryKey[|cycle]; the
 * worker then fills + verifies every day the dataset covers, automatically.
 */
export function configureRemoteLectionarySource(opts: { url: string; load?: DatasetLoader }): void {
  const load = opts.load ?? defaultDatasetLoader;
  registerReadingsSource({
    name: "remote-dataset",
    priority: 50,
    async resolve(date, o) {
      if (o.calendar !== "roman-ordinary" || o.locale !== "en") return null;
      if (datasetLoadedFor !== opts.url) {
        const raw = await load(opts.url).catch(() => null);
        datasetCache = raw ? ingestLectionaryDataset(raw) : null;
        datasetLoadedFor = opts.url;
      }
      if (!datasetCache) return null;
      const day = resolveLiturgicalDay(date);
      const sections =
        datasetCache[`${day.lectionaryKey}|${day.sundayCycle}`] ?? datasetCache[day.lectionaryKey];
      if (!sections || sections.length === 0) return null;
      const withText = sections.filter(
        (s) => typeof s.body === "string" && s.body.length > 0,
      ).length;
      return { sections, confidence: withText / sections.length };
    },
  });
}

/** Forget the cached remote dataset (forces a re-fetch on the next acquire). */
export function clearRemoteLectionaryCache(): void {
  datasetCache = null;
  datasetLoadedFor = null;
}

/**
 * Register the configured sources from the environment. Called once at worker
 * startup. Today: an optional LECTIONARY_DATA_URL authoritative dataset.
 */
export function initReadingsSources(): void {
  const url = process.env.LECTIONARY_DATA_URL;
  if (url && url.trim().length > 0) configureRemoteLectionarySource({ url: url.trim() });
}
