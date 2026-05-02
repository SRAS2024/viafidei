import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

export function listPublishedApparitions(locale: Locale, take = 30) {
  return prisma.marianApparition.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { title: "asc" },
    take,
  });
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
