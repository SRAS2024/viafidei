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

/**
 * Return every PUBLISHED guide whose slug begins with `sacrament-` or
 * `consecration-`. This is the source for the /sacraments tab — both
 * the seven Sacraments and the four major personal consecrations live
 * in the SpiritualLifeGuide table under stable namespaced slugs, so we
 * filter on slug prefix rather than introducing a new schema kind.
 */
export async function listSacramentGuides(locale: Locale) {
  const items = await prisma.spiritualLifeGuide.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ slug: { startsWith: "sacrament-" } }, { slug: { startsWith: "consecration-" } }],
    },
    include: { translations: { where: { locale } } },
    orderBy: [{ slug: "asc" }],
  });
  return {
    sacraments: items.filter((i) => i.slug.startsWith("sacrament-")),
    consecrations: items.filter((i) => i.slug.startsWith("consecration-")),
  };
}
