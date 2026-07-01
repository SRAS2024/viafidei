/**
 * Content-coverage self-knowledge — the worker's map of "where am I, across
 * every content type AND subtype, and what is not yet built?"
 *
 * The content goals (`ContentGoal`) and the brain's target selection work at the
 * TYPE level only (one row per content type). But the catalog
 * (`skills/catalog.ts`) declares the SUBTYPES each type must cover — e.g. PRAYER
 * has common / marian / eucharistic / saint / liturgical prayers; CHURCH_DOCUMENT
 * has encyclicals, exhortations, council constitutions, … A type can hit its
 * numeric target while a whole subtype sits at zero, and nothing today notices.
 *
 * This module gives the worker that self-knowledge. It counts published items
 * per (contentType, contentSubtype) — the subtype the publisher stamps on the
 * payload — compares against the catalog's declared subtypes, and produces:
 *   - a per-type coverage breakdown (published total, which subtypes are present,
 *     which are MISSING, how many were published untagged),
 *   - a ranked list of the missing (type, subtype) pairs to go fill, neediest
 *     type first, so the worker methodically covers EVERY subtype rather than
 *     over-serving the easy ones, and
 *   - a single recommended next target the discovery step steers toward.
 *
 * The compute is deterministic + fail-open (any error → empty model) and the
 * ranking/selection is a pure function, so it is fully unit-testable with
 * injected counts and no database.
 */

import type { PrismaClient } from "@prisma/client";

import { CONTENT_TYPE_CATALOG } from "./skills/catalog";

/** One (contentType, subtype) published count, as read from the ledger. */
export interface CoverageCountRow {
  contentType: string;
  /** payload.contentSubtype, or null when the item was published untagged. */
  subtype: string | null;
  count: number;
}

export interface SubtypeCoverage {
  subtype: string;
  published: number;
  present: boolean;
}

export interface TypeCoverage {
  contentType: string;
  published: number;
  /** Declared subtypes for this type (from the catalog). */
  hasSubtypes: boolean;
  subtypes: SubtypeCoverage[];
  /** Declared subtypes with zero published items. */
  missingSubtypes: string[];
  /** Published rows of a multi-subtype type that carry no contentSubtype. */
  untagged: number;
}

export interface CoverageTarget {
  contentType: string;
  /** The specific subtype to fill (null = type-level only). */
  subtype: string | null;
  reason: string;
}

export interface CoverageModel {
  types: TypeCoverage[];
  /** Every declared (type, subtype) with zero published, neediest type first. */
  prioritizedMissing: CoverageTarget[];
  /** The single recommended next target (prioritizedMissing[0]) or null. */
  nextTarget: CoverageTarget | null;
  /** Declared-subtype coverage fraction across the whole catalog. */
  subtypesPresent: number;
  subtypesTotal: number;
  summary: string;
}

/**
 * Build the coverage model from raw (type, subtype, count) rows + the catalog.
 * Pure + deterministic — exported for unit testing with injected counts.
 */
export function buildCoverageModel(rows: CoverageCountRow[]): CoverageModel {
  // Index counts: type -> total, and type -> (subtype -> count) + untagged.
  const typeTotal = new Map<string, number>();
  const subtypeCount = new Map<string, Map<string, number>>();
  const untaggedCount = new Map<string, number>();

  for (const row of rows) {
    const n = Number.isFinite(row.count) ? row.count : 0;
    typeTotal.set(row.contentType, (typeTotal.get(row.contentType) ?? 0) + n);
    if (row.subtype) {
      const m = subtypeCount.get(row.contentType) ?? new Map<string, number>();
      m.set(row.subtype, (m.get(row.subtype) ?? 0) + n);
      subtypeCount.set(row.contentType, m);
    } else {
      untaggedCount.set(row.contentType, (untaggedCount.get(row.contentType) ?? 0) + n);
    }
  }

  const types: TypeCoverage[] = [];
  let subtypesPresent = 0;
  let subtypesTotal = 0;

  for (const spec of CONTENT_TYPE_CATALOG) {
    const counts = subtypeCount.get(spec.type) ?? new Map<string, number>();
    const subtypes: SubtypeCoverage[] = spec.subtypes.map((s) => {
      const published = counts.get(s) ?? 0;
      return { subtype: s, published, present: published > 0 };
    });
    const missingSubtypes = subtypes.filter((s) => !s.present).map((s) => s.subtype);
    subtypesTotal += spec.subtypes.length;
    subtypesPresent += subtypes.filter((s) => s.present).length;
    types.push({
      contentType: spec.type,
      published: typeTotal.get(spec.type) ?? 0,
      hasSubtypes: spec.subtypes.length > 0,
      subtypes,
      missingSubtypes,
      untagged: untaggedCount.get(spec.type) ?? 0,
    });
  }

  // Rank missing (type, subtype): neediest type first (fewest published), then
  // the catalog's declared subtype order — so the worker fills the most
  // neglected corners of its coverage before padding the well-served ones.
  const withMissing = types.filter((t) => t.missingSubtypes.length > 0);
  withMissing.sort(
    (a, b) => a.published - b.published || a.contentType.localeCompare(b.contentType),
  );
  const prioritizedMissing: CoverageTarget[] = [];
  for (const t of withMissing) {
    for (const subtype of t.missingSubtypes) {
      prioritizedMissing.push({
        contentType: t.contentType,
        subtype,
        reason: `${t.contentType}/${subtype} has 0 published (type has ${t.published})`,
      });
    }
  }

  const summary =
    prioritizedMissing.length === 0
      ? `All ${subtypesTotal} declared subtypes have at least one published item.`
      : `${subtypesPresent}/${subtypesTotal} subtypes covered; ${prioritizedMissing.length} missing (e.g. ${prioritizedMissing
          .slice(0, 5)
          .map((t) => `${t.contentType}/${t.subtype}`)
          .join(", ")}).`;

  return {
    types,
    prioritizedMissing,
    nextTarget: prioritizedMissing[0] ?? null,
    subtypesPresent,
    subtypesTotal,
    summary,
  };
}

/**
 * Pick the next coverage target, rotating past recently-targeted (type, subtype)
 * pairs so the worker visits each missing corner in turn rather than fixating on
 * the single neediest one. Falls back to the top target when everything was
 * recently attempted. Pure + deterministic.
 */
export function pickCoverageTarget(
  model: CoverageModel,
  recentlyTargeted: ReadonlySet<string> = new Set(),
): CoverageTarget | null {
  if (model.prioritizedMissing.length === 0) return null;
  const fresh = model.prioritizedMissing.find(
    (t) => !recentlyTargeted.has(`${t.contentType}/${t.subtype}`),
  );
  return fresh ?? model.prioritizedMissing[0];
}

/**
 * Read per-(type, subtype) published counts from the ledger in one grouped
 * query. Counts the subtype the publisher stamped on the payload
 * (`payload->>'contentSubtype'`). Fail-open: any error yields [] so callers
 * degrade to "no coverage signal" rather than throwing.
 */
export async function fetchCoverageCounts(prisma: PrismaClient): Promise<CoverageCountRow[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ contentType: string; subtype: string | null; count: number }>
    >`
      SELECT "contentType" AS "contentType",
             payload->>'contentSubtype' AS "subtype",
             COUNT(*)::int AS "count"
      FROM "PublishedContent"
      WHERE "isPublished" = true
      GROUP BY "contentType", payload->>'contentSubtype'
    `;
    return rows.map((r) => ({
      contentType: String(r.contentType),
      subtype: r.subtype ?? null,
      count: Number(r.count) || 0,
    }));
  } catch {
    return [];
  }
}

/** Compute the live coverage model from the database. Fail-open. */
export async function computeCoverageModel(prisma: PrismaClient): Promise<CoverageModel> {
  const rows = await fetchCoverageCounts(prisma);
  return buildCoverageModel(rows);
}
