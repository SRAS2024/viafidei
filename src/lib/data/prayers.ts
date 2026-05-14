import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import {
  categorizePrayer,
  type PrayerCategory,
} from "../ingestion/sources/categorize";

const DEFAULT_TAKE = 60;
const PAGE_SIZE = 9;

export function listPublishedPrayers(locale: Locale, take = DEFAULT_TAKE) {
  return prisma.prayer.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { defaultTitle: "asc" },
    take,
  });
}

/**
 * Resolve the canonical PrayerCategory for one Prayer row. Trusts the
 * stored `category` column when it maps cleanly onto a recognised
 * bucket; otherwise re-runs the title+body categorizer.
 */
export function resolvePrayerCategory(p: {
  defaultTitle: string;
  body: string;
  category: string;
}): PrayerCategory {
  return categorizePrayer({ title: p.defaultTitle, body: p.body, category: p.category });
}

export async function listPublishedPrayersPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
  category?: PrayerCategory,
) {
  const skip = (page - 1) * pageSize;
  // We do the category resolution in JS so the filter is consistent with
  // what the public-facing /prayers tab shows. The Prayer.category column
  // is free-text and frequently disagrees with the actual content of the
  // prayer, so we re-run the categorizer here.
  const broad = await prisma.prayer.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { defaultTitle: "asc" },
  });
  const filtered = category
    ? broad.filter((p) => resolvePrayerCategory(p) === category)
    : broad;
  const total = filtered.length;
  const items = filtered.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminPrayers(take = 200) {
  return prisma.prayer.findMany({
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export function searchPrayers(q: string, take = 10) {
  return prisma.prayer.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { defaultTitle: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function listSavedPrayersForUser(userId: string, locale: Locale) {
  return prisma.userSavedPrayer.findMany({
    where: { userId },
    include: { prayer: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export function getPublishedPrayerBySlug(slug: string, locale: Locale) {
  return prisma.prayer.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      translations: { where: { locale } },
      categoryRel: true,
    },
  });
}

export async function getPublishedPrayersBySlugs(
  slugs: readonly string[],
  locale: Locale,
): Promise<Map<string, { defaultTitle: string; body: string }>> {
  if (slugs.length === 0) return new Map();
  const prayers = await prisma.prayer.findMany({
    where: { slug: { in: [...slugs] }, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
  const out = new Map<string, { defaultTitle: string; body: string }>();
  for (const p of prayers) {
    const tr = p.translations[0];
    out.set(p.slug, {
      defaultTitle: tr?.title ?? p.defaultTitle,
      body: tr?.body ?? p.body,
    });
  }
  return out;
}
