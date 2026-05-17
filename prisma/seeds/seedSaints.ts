import type { PrismaClient } from "@prisma/client";
import { SAINTS } from "./data/saints";
import { adaptLegacySaintSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route saint seed data through the content factory. See
 * seedPrayers.ts for the rationale — seed content must satisfy
 * exactly the same build / QA / persistence invariants as scraped
 * content, so it goes through the same pipeline.
 */
export async function seedSaints(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacySaintSeed(
    SAINTS.map((s) => ({
      slug: s.slug,
      canonicalName: s.canonicalName,
      feastDay: s.feastDay,
      patronages: s.patronages,
      biography: s.biography,
    })),
  );
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
