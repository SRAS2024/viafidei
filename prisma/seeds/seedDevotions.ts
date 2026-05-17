import type { PrismaClient } from "@prisma/client";
import { DEVOTIONS } from "./data/devotions";
import { adaptLegacyDevotionSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route devotion seed data through the content factory. See
 * seedPrayers.ts for the rationale — seed entries must satisfy the
 * same build / QA / persistence invariants as scraped content, so
 * they all flow through the same pipeline.
 */
export async function seedDevotions(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyDevotionSeed(DEVOTIONS);
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
