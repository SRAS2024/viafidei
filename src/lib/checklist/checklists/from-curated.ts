/**
 * Master checklists derived FROM the curated knowledge base.
 *
 * The curated registry (`src/lib/checklist/knowledge`) is the worker's ground
 * truth: every entry there is schema-valid, cited, and published verbatim by
 * the curated-ingest lane. The master checklists used to be a second,
 * hand-written list of the same items — and the two drifted apart (dozens of
 * checklist rows used a different slug for the same item, and none of them
 * carried the curated citations, so seeded rows sat DISCOVERED forever).
 *
 * `curatedChecklist()` makes the registry the single source of truth: one
 * ChecklistSeed per CuratedEntry, with `seedCitations` = the entry's own
 * citations and `authorityLevelHint` = its authority level. Hand-written seeds
 * survive only as `extras` — items intentionally NOT curated yet (the authoring
 * backlog) — and an extra whose slug later becomes curated is dropped
 * automatically, so a new knowledge entry never creates a duplicate row.
 */

import type { ChecklistContentType } from "@prisma/client";

import { ALL_CURATED_ENTRIES, type CuratedEntry } from "../knowledge";
import type { ChecklistSeed } from "./index";

/** Hand-written extras a checklist may layer on top of a curated entry. */
export type SeedOverride = Partial<Omit<ChecklistSeed, "canonicalSlug" | "seedCitations">>;

export interface CuratedChecklistOptions {
  /** Overrides (aliases, review flags, notes, priority) keyed by curated slug. */
  overrides?: Readonly<Record<string, SeedOverride>>;
  /** Payload fields copied into `ChecklistItem.metadata` (only when present). */
  metadataFields?: readonly string[];
  /** Hand-written seeds for items intentionally not curated (the allow-list). */
  extras?: readonly ChecklistSeed[];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** The display name of a curated entry: `title`, else `canonicalName`, else the slug. */
export function curatedDisplayName(entry: CuratedEntry): string {
  return str(entry.payload.title) ?? str(entry.payload.canonicalName) ?? entry.slug;
}

function metadataFor(
  entry: CuratedEntry,
  fields: readonly string[] | undefined,
): Record<string, unknown> | undefined {
  if (!fields?.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    const v = entry.payload[key];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** One ChecklistSeed for one curated entry. */
export function seedFromCurated(
  entry: CuratedEntry,
  index: number,
  options: CuratedChecklistOptions = {},
): ChecklistSeed {
  const override = options.overrides?.[entry.slug] ?? {};
  const seed: ChecklistSeed = {
    canonicalName: override.canonicalName ?? curatedDisplayName(entry),
    canonicalSlug: entry.slug,
    // Curated files are ordered by importance already (Our Father first…).
    priority: override.priority ?? 10 + index,
    authorityLevelHint: override.authorityLevelHint ?? entry.authorityLevel,
    seedCitations: entry.citations.map((sourceUrl) => ({
      sourceUrl,
      authorityLevel: entry.authorityLevel,
    })),
  };
  const summary = override.summary ?? str(entry.payload.summary);
  if (summary) seed.summary = summary;
  if (override.aliases?.length) seed.aliases = override.aliases;
  if (override.needsHumanReview != null) seed.needsHumanReview = override.needsHumanReview;
  if (override.humanReviewReason) seed.humanReviewReason = override.humanReviewReason;
  if (override.notes) seed.notes = override.notes;
  const metadata = { ...(metadataFor(entry, options.metadataFields) ?? {}), ...override.metadata };
  if (Object.keys(metadata).length) seed.metadata = metadata;
  return seed;
}

/**
 * The master checklist for a content type: every curated entry of that type
 * (in registry order) followed by the hand-written extras that are not (yet)
 * curated. Slugs are unique by construction.
 */
export function curatedChecklist(
  contentType: ChecklistContentType,
  options: CuratedChecklistOptions = {},
): ChecklistSeed[] {
  const entries = ALL_CURATED_ENTRIES.filter((e) => e.contentType === contentType);
  const seen = new Set<string>();
  const out: ChecklistSeed[] = [];
  entries.forEach((entry, index) => {
    if (seen.has(entry.slug)) return;
    seen.add(entry.slug);
    out.push(seedFromCurated(entry, index, options));
  });
  for (const extra of options.extras ?? []) {
    if (seen.has(extra.canonicalSlug)) continue; // now curated — the registry wins
    seen.add(extra.canonicalSlug);
    out.push(extra);
  }
  return out;
}

/**
 * Hand-written extras that are still NOT curated — the explicit allow-list a
 * checklist slug must appear on when it is not in the registry.
 */
export function uncuratedExtras(
  contentType: ChecklistContentType,
  extras: readonly ChecklistSeed[],
): string[] {
  const curated = new Set(
    ALL_CURATED_ENTRIES.filter((e) => e.contentType === contentType).map((e) => e.slug),
  );
  return extras.map((e) => e.canonicalSlug).filter((slug) => !curated.has(slug));
}
