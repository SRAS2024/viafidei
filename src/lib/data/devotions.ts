import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

const PAGE_SIZE = 9;

const PUBLIC_DEVOTION_WHERE = STRICT_PUBLIC_WHERE_CLAUSE;

export function listPublishedDevotions(locale: Locale, take = 60) {
  return prisma.devotion.findMany({
    where: PUBLIC_DEVOTION_WHERE,
    include: { translations: { where: { locale } } },
    orderBy: { title: "asc" },
    take,
  });
}

export async function listPublishedDevotionsPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.devotion.findMany({
      where: PUBLIC_DEVOTION_WHERE,
      include: { translations: { where: { locale } } },
      orderBy: { title: "asc" },
      take: pageSize,
      skip,
    }),
    prisma.devotion.count({ where: PUBLIC_DEVOTION_WHERE }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminDevotions(take = 200) {
  return prisma.devotion.findMany({
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export function searchDevotions(q: string, take = 10) {
  return prisma.devotion.findMany({
    where: {
      ...PUBLIC_DEVOTION_WHERE,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function listSavedDevotionsForUser(userId: string) {
  return prisma.userSavedDevotion.findMany({
    where: { userId },
    include: { devotion: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getPublishedDevotionBySlug(slug: string, locale: Locale) {
  return prisma.devotion.findFirst({
    where: { slug, ...PUBLIC_DEVOTION_WHERE },
    include: { translations: { where: { locale } } },
  });
}
