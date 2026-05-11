import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

const PAGE_SIZE = 9;

export function listPublishedSaints(locale: Locale, take = 60) {
  return prisma.saint.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { canonicalName: "asc" },
    take,
  });
}

export async function listPublishedSaintsPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.saint.findMany({
      where: { status: "PUBLISHED" },
      include: { translations: { where: { locale } } },
      orderBy: { canonicalName: "asc" },
      take: pageSize,
      skip,
    }),
    prisma.saint.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminSaints(take = 200) {
  return prisma.saint.findMany({
    orderBy: { canonicalName: "asc" },
    take,
  });
}

export function searchSaints(q: string, take = 10) {
  return prisma.saint.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { canonicalName: { contains: q, mode: "insensitive" } },
        { biography: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function listSavedSaintsForUser(userId: string) {
  return prisma.userSavedSaint.findMany({
    where: { userId },
    include: { saint: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getPublishedSaintBySlug(slug: string, locale: Locale) {
  return prisma.saint.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
