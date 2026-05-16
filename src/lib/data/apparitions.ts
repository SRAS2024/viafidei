import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

const PAGE_SIZE = 9;

// Strict public-visibility gate. Apparitions only appear publicly
// when their MarianApparition row passes the strict QA contract.
const PUBLIC_APPARITION_WHERE = STRICT_PUBLIC_WHERE_CLAUSE;

export function listPublishedApparitions(locale: Locale, take = 30) {
  return prisma.marianApparition.findMany({
    where: PUBLIC_APPARITION_WHERE,
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
      where: PUBLIC_APPARITION_WHERE,
      include: { translations: { where: { locale } } },
      orderBy: { title: "asc" },
      take: pageSize,
      skip,
    }),
    prisma.marianApparition.count({ where: PUBLIC_APPARITION_WHERE }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminApparitions() {
  return prisma.marianApparition.findMany({ orderBy: { title: "asc" } });
}

export function searchApparitions(q: string, take = 10) {
  return prisma.marianApparition.findMany({
    where: {
      ...PUBLIC_APPARITION_WHERE,
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
    where: { slug, ...PUBLIC_APPARITION_WHERE },
    include: { translations: { where: { locale } } },
  });
}
