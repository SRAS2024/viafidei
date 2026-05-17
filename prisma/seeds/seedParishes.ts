import type { PrismaClient } from "@prisma/client";
import { PARISHES } from "./data/parishes";
import { adaptLegacyParishSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route parish seed data through the content factory. See
 * seedPrayers.ts for the rationale — seed entries must satisfy the
 * same build / QA / persistence invariants as scraped content, so
 * they all flow through the same pipeline.
 */
export async function seedParishes(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyParishSeed(
    PARISHES.map((p) => ({
      slug: p.slug,
      name: p.name,
      address: p.address ?? null,
      city: p.city ?? null,
      region: p.region ?? null,
      country: p.country ?? null,
      diocese: p.diocese ?? null,
      websiteUrl: p.websiteUrl ?? null,
    })),
  );
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
