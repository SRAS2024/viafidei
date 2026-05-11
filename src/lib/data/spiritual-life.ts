import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import type { SpiritualLifeKind } from "@prisma/client";

const PAGE_SIZE = 9;

export function listPublishedSpiritualLifeGuides(
  locale: Locale,
  kind?: SpiritualLifeKind,
  take = 60,
) {
  return prisma.spiritualLifeGuide.findMany({
    where: { status: "PUBLISHED", ...(kind ? { kind } : {}) },
    include: { translations: { where: { locale } } },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
    take,
  });
}

export async function listPublishedSpiritualLifeGuidesPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
) {
  const skip = (page - 1) * pageSize;
  const where = { status: "PUBLISHED" as const };
  const [items, total] = await Promise.all([
    prisma.spiritualLifeGuide.findMany({
      where,
      include: { translations: { where: { locale } } },
      orderBy: [{ kind: "asc" }, { title: "asc" }],
      take: pageSize,
      skip,
    }),
    prisma.spiritualLifeGuide.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminSpiritualLifeGuides(take = 200) {
  return prisma.spiritualLifeGuide.findMany({ orderBy: { updatedAt: "desc" }, take });
}

export function getPublishedSpiritualLifeGuideBySlug(slug: string, locale: Locale) {
  return prisma.spiritualLifeGuide.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
