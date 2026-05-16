import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";
import type { LiturgyKind } from "@prisma/client";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

const PUBLIC_LITURGY_WHERE = STRICT_PUBLIC_WHERE_CLAUSE;

export function listPublishedLiturgyEntries(locale: Locale, kind?: LiturgyKind, take = 60) {
  return prisma.liturgyEntry.findMany({
    where: { ...PUBLIC_LITURGY_WHERE, ...(kind ? { kind } : {}) },
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
    where: { slug, ...PUBLIC_LITURGY_WHERE },
    include: { translations: { where: { locale } } },
  });
}
