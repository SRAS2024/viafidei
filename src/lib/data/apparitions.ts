import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

const PAGE_SIZE = 9;

export function listPublishedApparitions(locale: Locale, take = 30) {
  return prisma.marianApparition.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { title: "asc" },
    take,
  });
}

export async function listPublishedApparitionsPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.marianApparition.findMany({
      where: { status: "PUBLISHED" },
      include: { translations: { where: { locale } } },
      orderBy: { title: "asc" },
      take: pageSize,
      skip,
    }),
    prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminApparitions() {
  return prisma.marianApparition.findMany({ orderBy: { title: "asc" } });
}

export function searchApparitions(q: string, take = 10) {
  return prisma.marianApparition.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function getPublishedApparitionBySlug(slug: string, locale: Locale) {
  return prisma.marianApparition.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
