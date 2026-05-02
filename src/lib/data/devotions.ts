import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

export function listPublishedDevotions(locale: Locale, take = 60) {
  return prisma.devotion.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { title: "asc" },
    take,
  });
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
      status: "PUBLISHED",
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
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
