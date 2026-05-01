import type { PrismaClient } from "@prisma/client";
import { seedPrayers } from "./seedPrayers";
import { seedSaints } from "./seedSaints";
import { seedApparitions } from "./seedApparitions";
import { seedSiteSettings } from "./seedSiteSettings";

export async function runSeeds(prisma: PrismaClient): Promise<void> {
  await seedPrayers(prisma);
  await seedSaints(prisma);
  await seedApparitions(prisma);
  await seedSiteSettings(prisma);
}
