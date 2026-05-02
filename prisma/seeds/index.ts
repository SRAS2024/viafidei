import type { PrismaClient } from "@prisma/client";
import { seedPrayers } from "./seedPrayers";
import { seedSaints } from "./seedSaints";
import { seedApparitions } from "./seedApparitions";
import { seedDevotions } from "./seedDevotions";
import { seedParishes } from "./seedParishes";
import { seedLiturgyEntries } from "./seedLiturgyEntries";
import { seedSpiritualLifeGuides } from "./seedSpiritualLifeGuides";
import { seedSiteSettings } from "./seedSiteSettings";

export type SeedSummary = {
  prayers: number;
  saints: number;
  apparitions: number;
  devotions: number;
  parishes: number;
  liturgyEntries: number;
  spiritualLifeGuides: number;
};

export async function runSeeds(prisma: PrismaClient): Promise<SeedSummary> {
  const prayers = await seedPrayers(prisma);
  const saints = await seedSaints(prisma);
  const apparitions = await seedApparitions(prisma);
  const devotions = await seedDevotions(prisma);
  const parishes = await seedParishes(prisma);
  const liturgyEntries = await seedLiturgyEntries(prisma);
  const spiritualLifeGuides = await seedSpiritualLifeGuides(prisma);
  await seedSiteSettings(prisma);

  return { prayers, saints, apparitions, devotions, parishes, liturgyEntries, spiritualLifeGuides };
}

export async function verifySeedContent(prisma: PrismaClient): Promise<void> {
  const [prayers, saints, apparitions, devotions, liturgy, guides] = await Promise.all([
    prisma.prayer.count({ where: { status: "PUBLISHED" } }),
    prisma.saint.count({ where: { status: "PUBLISHED" } }),
    prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
    prisma.devotion.count({ where: { status: "PUBLISHED" } }),
    prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
    prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
  ]);

  const failures: string[] = [];
  if (prayers === 0) failures.push("prayers");
  if (saints === 0) failures.push("saints");
  if (apparitions === 0) failures.push("apparitions");
  if (devotions === 0) failures.push("devotions");
  if (liturgy === 0) failures.push("liturgyEntries");
  if (guides === 0) failures.push("spiritualLifeGuides");

  if (failures.length > 0) {
    throw new Error(`Seed verification failed: no published content for [${failures.join(", ")}]`);
  }

  console.log(
    `Seed verification OK — prayers:${prayers} saints:${saints} apparitions:${apparitions} devotions:${devotions} liturgy:${liturgy} guides:${guides}`,
  );
}
