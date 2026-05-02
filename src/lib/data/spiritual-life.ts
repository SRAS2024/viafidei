import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import type { SpiritualLifeKind } from "@prisma/client";

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

export function listAdminSpiritualLifeGuides(take = 200) {
  return prisma.spiritualLifeGuide.findMany({ orderBy: { updatedAt: "desc" }, take });
}

export function getPublishedSpiritualLifeGuideBySlug(slug: string, locale: Locale) {
  return prisma.spiritualLifeGuide.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
