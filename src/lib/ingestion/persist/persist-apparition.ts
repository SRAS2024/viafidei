import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedApparition } from "../types";
import type { PersistOutcomeDetailed } from "./persist-prayer";

async function findExistingApparition(item: IngestedApparition) {
  if (item.externalSourceKey) {
    const byKey = await prisma.marianApparition.findUnique({
      where: { externalSourceKey: item.externalSourceKey },
    });
    if (byKey) return byKey;
  }
  return prisma.marianApparition.findUnique({ where: { slug: item.slug } });
}

export async function persistApparition(
  item: IngestedApparition,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const existing = await findExistingApparition(item);
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    // Spec: "only add content if it is not already in the database." Any
    // existing row is left untouched; ingestion is strictly additive.
    return {
      outcome: "skipped",
      slug: existing.slug,
      contentRef: existing.slug || existing.title,
      reason: "already in catalog",
    };
  }

  await prisma.marianApparition.create({
    data: {
      slug: item.slug,
      title: item.title,
      location: item.location ?? null,
      country: item.country ?? null,
      approvedStatus: item.approvedStatus,
      summary: item.summary,
      officialPrayer: item.officialPrayer ?? null,
      externalSourceKey: item.externalSourceKey ?? null,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return {
    outcome: "created",
    slug: item.slug,
    contentRef: item.slug || item.title,
  };
}
