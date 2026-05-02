import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

const DEFAULT_TAKE = 60;

export function listPublishedPrayers(locale: Locale, take = DEFAULT_TAKE) {
  return prisma.prayer.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { defaultTitle: "asc" },
    take,
  });
}

export function listAdminPrayers(take = 100) {
  return prisma.prayer.findMany({
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export function searchPrayers(q: string, take = 10) {
  return prisma.prayer.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { defaultTitle: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function listSavedPrayersForUser(userId: string, locale: Locale) {
  return prisma.userSavedPrayer.findMany({
    where: { userId },
    include: { prayer: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
}
