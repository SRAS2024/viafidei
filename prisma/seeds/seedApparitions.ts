import type { PrismaClient } from "@prisma/client";
import { APPARITIONS } from "./data/apparitions";
import { adaptLegacyApparitionSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route apparition seed data through the content factory. See
 * seedPrayers.ts for the rationale — seed entries must satisfy the
 * same build / QA / persistence invariants as scraped content, so
 * they all flow through the same pipeline.
 */
export async function seedApparitions(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyApparitionSeed(APPARITIONS);
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
