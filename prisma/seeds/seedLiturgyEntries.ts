import type { PrismaClient } from "@prisma/client";
import { LITURGY_ENTRIES } from "./data/liturgyEntries";
import { adaptLegacyLiturgySeed, routeSeedThroughFactory } from "./factorySeed";

/**
 * Route liturgy seed data through the content factory. See
 * seedPrayers.ts for the rationale.
 */
export async function seedLiturgyEntries(prisma: PrismaClient): Promise<number> {
  const entries = adaptLegacyLiturgySeed(
    LITURGY_ENTRIES.map((e) => ({
      slug: e.slug,
      title: e.title,
      summary: e.summary ?? null,
      body: e.body,
      kind: e.kind,
    })),
  );
  const summary = await routeSeedThroughFactory(prisma, entries);
  return summary.persistedCreated + summary.persistedUpdated;
}
