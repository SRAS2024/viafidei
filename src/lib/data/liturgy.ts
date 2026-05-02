import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import type { LiturgyKind } from "@prisma/client";

export function listPublishedLiturgyEntries(locale: Locale, kind?: LiturgyKind, take = 60) {
  return prisma.liturgyEntry.findMany({
    where: { status: "PUBLISHED", ...(kind ? { kind } : {}) },
    include: { translations: { where: { locale } } },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
    take,
  });
}

export function listAdminLiturgyEntries(take = 200) {
  return prisma.liturgyEntry.findMany({ orderBy: { updatedAt: "desc" }, take });
}

export function getPublishedLiturgyBySlug(slug: string, locale: Locale) {
  return prisma.liturgyEntry.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
