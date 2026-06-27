/**
 * Public-facing data access — reads from the PublishedContent table
 * written by the checklist-first worker.
 *
 * Every public page on the site goes through these helpers; there is no
 * other path from the database to the public site.
 */

import type { Metadata } from "next";
import type { ChecklistContentType } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

export interface PublishedItem {
  id: string;
  checklistItemId: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  /** One-line descriptive subtitle (stored, or generated as a fallback). */
  subtitle: string;
  payload: Record<string, unknown>;
  authorityLevel: string;
  version: number;
  publishedAt: Date | null;
}

function deserialize(
  row: Awaited<ReturnType<typeof prisma.publishedContent.findFirst>>,
): PublishedItem | null {
  if (!row) return null;
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    checklistItemId: row.checklistItemId,
    contentType: row.contentType,
    slug: row.slug,
    title: row.title,
    subtitle:
      (row as { subtitle?: string | null }).subtitle ??
      generateContentSubtitle({
        contentType: row.contentType,
        contentSubtype: (payload.contentSubtype as string | null) ?? null,
        title: row.title,
        fields: payload,
      }),
    payload,
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

/**
 * Resolve a published item by slug across several candidate content types, in
 * order — used by the routes that serve more than one type from one path
 * (Our Lady = Marian title or apparition; Liturgy & History = liturgical entry
 * or church document). Returns the first match, or null.
 */
export async function getAnyPublishedBySlug(
  slug: string,
  contentTypes: ChecklistContentType[],
): Promise<PublishedItem | null> {
  for (const contentType of contentTypes) {
    const item = await getPublishedBySlug(contentType, slug);
    if (item) return item;
  }
  return null;
}

/** Short, human label per content type for the share-card "VIA FIDEI · …" line. */
const CONTENT_TYPE_LABEL: Record<ChecklistContentType, string> = {
  PRAYER: "Prayer",
  SAINT: "Saint",
  APPARITION: "Apparition",
  MARIAN_TITLE: "Our Lady",
  POPE: "Pope",
  DOCTOR: "Doctor of the Church",
  PARISH: "Parish",
  DEVOTION: "Devotion",
  NOVENA: "Novena",
  GUIDE: "Guide",
  SACRAMENT: "Sacrament",
  LITURGICAL: "Liturgy",
  CHURCH_DOCUMENT: "Church Document",
  RITE: "Rite",
  SPIRITUAL_PRACTICE: "Spiritual Life",
};

/** The label shown on the share image — litanies (PRAYER + prayerType "litany") read "Litany". */
function shareTypeLabel(item: PublishedItem): string {
  if (item.contentType === "PRAYER" && item.payload.prayerType === "litany") return "Litany";
  return CONTENT_TYPE_LABEL[item.contentType] ?? "Via Fidei";
}

/**
 * The branded share-image URL for a content card: the Via Fidei crucifix mark
 * with the item's own title rendered in it (see `app/api/og`). Relative so Next
 * resolves it against `metadataBase` (the canonical domain) in the meta tag.
 */
export function shareImageUrl(title: string, typeLabel: string): string {
  const q = new URLSearchParams({ title, type: typeLabel });
  return `/api/og?${q.toString()}`;
}

/**
 * Build per-page share/SEO metadata for a published content card, so that a
 * shared link unfurls with the card's own title and summary, a branded share
 * image (the crucifix mark with the item's title in it), and the site favicon /
 * Open Graph defaults inherited from the root layout — rather than the generic
 * site title and the browser's default page icon. Returns empty metadata for a
 * missing item, letting the page fall through to notFound().
 */
export function buildPublishedMetadata(item: PublishedItem | null): Metadata {
  if (!item) return {};
  const rawSummary =
    typeof item.payload.summary === "string" && item.payload.summary.trim()
      ? item.payload.summary.trim()
      : item.subtitle || item.title;
  const description = rawSummary.length > 200 ? `${rawSummary.slice(0, 197)}…` : rawSummary;
  const image = shareImageUrl(item.title, shareTypeLabel(item));
  return {
    title: item.title,
    description,
    openGraph: {
      title: `${item.title} · Via Fidei`,
      description,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: item.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${item.title} · Via Fidei`,
      description,
      images: [image],
    },
  };
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
  NOVENA: "novenas",
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
