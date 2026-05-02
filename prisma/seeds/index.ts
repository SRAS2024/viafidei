import type { PrismaClient } from "@prisma/client";
import { seedPrayers } from "./seedPrayers";
import { seedSaints } from "./seedSaints";
import { seedApparitions } from "./seedApparitions";
import { seedDevotions } from "./seedDevotions";
import { seedParishes } from "./seedParishes";
import { seedLiturgyEntries } from "./seedLiturgyEntries";
import { seedSpiritualLifeGuides } from "./seedSpiritualLifeGuides";
import { seedSiteSettings } from "./seedSiteSettings";

export async function runSeeds(prisma: PrismaClient): Promise<void> {
  await seedPrayers(prisma);
  await seedSaints(prisma);
  await seedApparitions(prisma);
  await seedDevotions(prisma);
  await seedParishes(prisma);
  await seedLiturgyEntries(prisma);
  await seedSpiritualLifeGuides(prisma);
  await seedSiteSettings(prisma);
}
