/**
 * Public-facing data access — reads from the PublishedContent table
 * written by the checklist-first worker.
 *
 * Every public page on the site goes through these helpers; there is no
 * other path from the database to the public site.
 */

import type { ChecklistContentType } from "@prisma/client";

import { prisma } from "@/lib/db/client";

export interface PublishedItem {
  id: string;
  checklistItemId: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  authorityLevel: string;
  version: number;
  publishedAt: Date | null;
}

function deserialize(
  row: Awaited<ReturnType<typeof prisma.publishedContent.findFirst>>,
): PublishedItem | null {
  if (!row) return null;
  return {
    id: row.id,
    checklistItemId: row.checklistItemId,
    contentType: row.contentType,
    slug: row.slug,
    title: row.title,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    authorityLevel: row.authorityLevel,
    version: row.version,
    publishedAt: row.publishedAt,
  };
}

export async function listPublished(contentType: ChecklistContentType): Promise<PublishedItem[]> {
  const rows = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true },
    orderBy: { title: "asc" },
  });
  return rows.map((row) => deserialize(row)!).filter(Boolean);
}

export async function getPublishedBySlug(
  contentType: ChecklistContentType,
  slug: string,
): Promise<PublishedItem | null> {
  const row = await prisma.publishedContent.findFirst({
    where: { contentType, slug, isPublished: true },
  });
  return deserialize(row);
}

export async function listAllPublishedSlugs(contentType: ChecklistContentType): Promise<string[]> {
  const rows = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

export async function countPublished(): Promise<Record<ChecklistContentType, number>> {
  const rows = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: true,
  });
  const out: Partial<Record<ChecklistContentType, number>> = {};
  for (const row of rows) {
    out[row.contentType] = row._count;
  }
  return out as Record<ChecklistContentType, number>;
}

export async function searchPublished(query: string, limit = 20): Promise<PublishedItem[]> {
  if (!query.trim()) return [];
  const rows = await prisma.publishedContent.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { slug: { contains: query.toLowerCase(), mode: "insensitive" } },
      ],
    },
    take: limit,
  });
  return rows.map((row) => deserialize(row)!).filter(Boolean);
}

/** Content type → the header search-suggestion group it appears under. */
const CONTENT_TYPE_TO_SUGGEST_GROUP: Record<ChecklistContentType, string> = {
  PRAYER: "prayers",
  SAINT: "saints",
  APPARITION: "apparitions",
  MARIAN_TITLE: "apparitions",
  POPE: "popes",
  DOCTOR: "doctors",
  PARISH: "parishes",
  DEVOTION: "devotions",
  NOVENA: "devotions",
  GUIDE: "guides",
  SACRAMENT: "sacraments",
  LITURGICAL: "liturgy",
  CHURCH_DOCUMENT: "documents",
  RITE: "rites",
  SPIRITUAL_PRACTICE: "spiritualLife",
};

export interface SearchSuggestion {
  group: string;
  id: string;
  slug: string;
  label: string;
}

/**
 * Autocomplete suggestions for the header search, drawn from every content
 * type and grouped by tab, capped at `perGroup` each. Matches title and slug.
 */
export async function suggestPublished(query: string, perGroup = 3): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.publishedContent.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q.toLowerCase(), mode: "insensitive" } },
      ],
    },
    orderBy: { title: "asc" },
    take: 120,
  });
  const byGroup = new Map<string, SearchSuggestion[]>();
  for (const row of rows) {
    const group = CONTENT_TYPE_TO_SUGGEST_GROUP[row.contentType] ?? "prayers";
    const arr = byGroup.get(group) ?? [];
    if (arr.length >= perGroup) continue;
    arr.push({ group, id: row.id, slug: row.slug, label: row.title });
    byGroup.set(group, arr);
  }
  return [...byGroup.values()].flat();
}
