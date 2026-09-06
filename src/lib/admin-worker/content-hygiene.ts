/**
 * Content hygiene — small, bounded, self-healing repairs to rows that are
 * already public, so a display bug fixed in code also gets fixed in the
 * catalog that was published before the fix.
 *
 * Two repairs, both deterministic and idempotent:
 *
 *   1. TITLE == SLUG. Structured (Wikidata) saints published before the
 *      canonicalName fallback landed carry their slug as their title, so the
 *      public page, the search results and the share card all read
 *      "saint-our-lady-of-the-rosary-of-chiquinquira". The real display name is
 *      still in the payload (`title` / `canonicalName` / `name`); when it is
 *      not, the slug is humanised ("Saint Our Lady of the Rosary of
 *      Chiquinquira"). Every repair is snapshotted first (PublishedContentVersion)
 *      so it is reversible.
 *
 *   2. STALE SUBTITLES. The subtitle is derived at publish time from the
 *      content type + subtype + fields. When the generator improves (a guide's
 *      kind, a parish's designation, …) the stored line falls behind. A rolling
 *      cursor re-derives a bounded batch per pass and rewrites only the rows
 *      whose subtitle actually changed — the subtitle is not user content, so
 *      no version snapshot is needed.
 *
 * Fail-open and cheap: a few indexed queries per pass, never a full-table
 * payload load, so it is safe against a remote database.
 */

import type { PrismaClient } from "@prisma/client";

import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { derivedColumnsFor, type DerivedColumns } from "@/lib/content-shared/derived-columns";

import { computeContentChecksum } from "./cache-freshness";
import { snapshotPublishedContent } from "./content-protection";
import { writeAdminWorkerLog } from "./logs";

const SUBTITLE_CURSOR_KEY = "content-hygiene:subtitle-cursor";
const SLUG_LIKE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SMALL_WORDS = new Set(["of", "the", "and", "in", "at", "on", "de", "la", "del", "da", "di"]);

export interface ContentHygieneResult {
  titlesRepaired: number;
  subtitlesRefreshed: number;
  scanned: number;
}

/** "saint-john-of-the-cross" → "Saint John of the Cross". Pure. */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi)$/.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** The display title a row SHOULD carry, given its payload. Pure. */
export function repairedTitle(slug: string, payload: Record<string, unknown>): string {
  for (const key of ["title", "canonicalName", "name"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim() && !(v.trim() === slug || SLUG_LIKE.test(v.trim()))) {
      return v.trim();
    }
  }
  return humanizeSlug(slug);
}

/** True when a stored title is really a slug (the display bug). Pure. */
export function titleLooksLikeSlug(title: string, slug: string): boolean {
  const t = title.trim();
  return t.length === 0 || t === slug || SLUG_LIKE.test(t);
}

interface HygieneRow {
  id: string;
  contentType: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: unknown;
}

async function repairSlugTitles(
  prisma: PrismaClient,
  limit: number,
  passId?: string,
): Promise<number> {
  // Postgres can compare the two columns directly; Prisma's filter API cannot.
  // Read-only query, bounded, on published rows only.
  let rows: HygieneRow[] = [];
  try {
    rows = await prisma.$queryRaw<HygieneRow[]>`
      SELECT "id", "contentType"::text AS "contentType", "slug", "title", "subtitle", "payload"
      FROM "PublishedContent"
      WHERE "isPublished" = true
        AND ("title" = "slug" OR "title" ~ '^[a-z0-9]+(-[a-z0-9]+)+$' OR btrim("title") = '')
      ORDER BY "updatedAt" ASC
      LIMIT ${limit}`;
  } catch {
    return 0;
  }
  let repaired = 0;
  for (const row of rows) {
    const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
      string,
      unknown
    >;
    if (!titleLooksLikeSlug(row.title, row.slug)) continue;
    const title = repairedTitle(row.slug, payload);
    if (title === row.title) continue;
    const subtitle = generateContentSubtitle({
      contentType: row.contentType,
      contentSubtype: typeof payload.contentSubtype === "string" ? payload.contentSubtype : null,
      title,
      fields: payload,
    });
    try {
      await snapshotPublishedContent(prisma, row.id, {
        changeSummary: `title "${row.title}" → "${title}"`,
        reason: "content hygiene: title was the slug",
        changeKind: "repair",
        qualityScore: null,
        evidenceCount: 0,
      });
      await prisma.publishedContent.update({
        where: { id: row.id },
        data: {
          title,
          subtitle,
          contentChecksum: computeContentChecksum(title, payload),
        },
      });
      // Keep the checklist item's canonical name honest too (it feeds admin lists).
      await prisma.checklistItem
        .updateMany({
          where: { contentType: row.contentType as never, canonicalSlug: row.slug },
          data: { canonicalName: title },
        })
        .catch(() => undefined);
      repaired += 1;
    } catch {
      // leave the row for the next pass
    }
  }
  if (repaired > 0) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CLEANUP",
      severity: "INFO",
      eventName: "content_hygiene_titles",
      message: `Content hygiene repaired ${repaired} published title(s) that were still slugs.`,
      safeMetadata: { repaired, scanned: rows.length },
    }).catch(() => undefined);
  }
  return repaired;
}

async function readCursor(prisma: PrismaClient): Promise<string> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SUBTITLE_CURSOR_KEY } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue ?? {}) as { afterId?: string };
  return typeof v.afterId === "string" ? v.afterId : "";
}

async function writeCursor(prisma: PrismaClient, afterId: string): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SUBTITLE_CURSOR_KEY } },
      update: { memoryValue: { afterId }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: SUBTITLE_CURSOR_KEY,
        memoryValue: { afterId },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

type DerivedKey = keyof DerivedColumns;
const DERIVED_KEYS: DerivedKey[] = [
  "feastMonth",
  "feastDayOfMonth",
  "sortYear",
  "subtype",
  "latitude",
  "longitude",
  "region",
  "sourceRef",
  "addressKey",
];

/**
 * Rolling sweep: re-derive the subtitle AND the indexed query columns for a
 * bounded batch, writing only rows where something actually changed. This is
 * how rows published before a column existed (or before a generator improved)
 * catch up without a one-off script — the worker keeps its own catalog honest.
 */
async function refreshDerived(prisma: PrismaClient, limit: number): Promise<number> {
  const afterId = await readCursor(prisma);
  let rows: Array<
    {
      id: string;
      contentType: string;
      slug: string;
      title: string;
      subtitle: string | null;
      payload: unknown;
    } & Partial<DerivedColumns>
  > = [];
  try {
    rows = await prisma.publishedContent.findMany({
      where: { isPublished: true, ...(afterId ? { id: { gt: afterId } } : {}) },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        contentType: true,
        slug: true,
        title: true,
        subtitle: true,
        payload: true,
        feastMonth: true,
        feastDayOfMonth: true,
        sortYear: true,
        subtype: true,
        latitude: true,
        longitude: true,
        region: true,
        sourceRef: true,
        addressKey: true,
      },
    });
  } catch {
    return 0;
  }
  // Wrap around once the end of the catalog is reached so drift is caught again.
  await writeCursor(prisma, rows.length < limit ? "" : rows[rows.length - 1]!.id);

  let refreshed = 0;
  for (const row of rows) {
    const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
      string,
      unknown
    >;
    const subtitle = generateContentSubtitle({
      contentType: String(row.contentType),
      contentSubtype: typeof payload.contentSubtype === "string" ? payload.contentSubtype : null,
      title: row.title,
      fields: payload,
    });
    const derived = derivedColumnsFor(String(row.contentType), payload);
    const data: Record<string, unknown> = {};
    if (subtitle !== (row.subtitle ?? "")) data.subtitle = subtitle;
    for (const key of DERIVED_KEYS) {
      if ((row[key] ?? null) !== derived[key]) data[key] = derived[key];
    }
    if (Object.keys(data).length === 0) continue;
    try {
      await prisma.publishedContent.update({ where: { id: row.id }, data });
      refreshed += 1;
    } catch {
      /* next pass */
    }
  }
  return refreshed;
}

/**
 * One bounded hygiene sweep. `titleLimit` slug-titles and `subtitleLimit`
 * subtitle checks per call; both default to sizes that stay cheap over a
 * remote database.
 */
export async function runContentHygiene(
  prisma: PrismaClient,
  opts: { passId?: string; titleLimit?: number; subtitleLimit?: number } = {},
): Promise<ContentHygieneResult> {
  const titleLimit = opts.titleLimit ?? 100;
  const subtitleLimit = opts.subtitleLimit ?? 200;
  const titlesRepaired = await repairSlugTitles(prisma, titleLimit, opts.passId).catch(() => 0);
  const subtitlesRefreshed = await refreshDerived(prisma, subtitleLimit).catch(() => 0);
  return { titlesRepaired, subtitlesRefreshed, scanned: titleLimit + subtitleLimit };
}
