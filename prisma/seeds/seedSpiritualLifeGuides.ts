import type { PrismaClient } from "@prisma/client";
import { SPIRITUAL_LIFE_GUIDES } from "./data/spiritualLifeGuides";
import { adaptLegacyGuideSeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route spiritual-life-guide seed data through the content factory.
 * The factory routes each entry to the correct content type
 * (Sacrament / Rosary / Consecration / SpiritualGuidance) based on
 * the seed kind and slug prefix.
 */
export async function seedSpiritualLifeGuides(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyGuideSeed(
    SPIRITUAL_LIFE_GUIDES.map((g) => ({
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      bodyText: g.bodyText ?? null,
      kind: g.kind,
      steps: g.steps,
    })),
  );
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
