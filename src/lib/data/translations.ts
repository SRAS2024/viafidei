import { prisma } from "../db/client";

export type TranslationCounts = {
  prayerCount: number;
  saintCount: number;
  apparitionCount: number;
};

export async function getTranslationCounts(): Promise<TranslationCounts> {
  const [prayerCount, saintCount, apparitionCount] = await Promise.all([
    prisma.prayerTranslation.count(),
    prisma.saintTranslation.count(),
    prisma.marianApparitionTranslation.count(),
  ]);
  return { prayerCount, saintCount, apparitionCount };
}
