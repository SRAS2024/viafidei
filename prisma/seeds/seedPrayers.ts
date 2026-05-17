import type { PrismaClient } from "@prisma/client";
import { PRAYERS } from "./data/prayers";
import { adaptLegacyPrayerSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route prayer seed data through the content factory. Each entry is
 * wrapped in a synthetic SourceDocument and pushed through build →
 * normalize → enrich → strict QA → persist, so the resulting rows
 * carry the same publicRenderReady / isThresholdEligible /
 * packageValidationStatus / contentPackageVersion flags as
 * factory-produced rows from real sources.
 *
 * Invalid seed entries are deleted and logged just like any other
 * failed build — they never become public.
 */
export async function seedPrayers(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyPrayerSeed(PRAYERS);
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
