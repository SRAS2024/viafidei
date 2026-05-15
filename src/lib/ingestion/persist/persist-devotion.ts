import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedDevotion } from "../types";
import type { PersistOutcomeDetailed } from "./persist-prayer";

async function findExistingDevotion(item: IngestedDevotion) {
  if (item.externalSourceKey) {
    const byKey = await prisma.devotion.findUnique({
      where: { externalSourceKey: item.externalSourceKey },
    });
    if (byKey) return byKey;
  }
  return prisma.devotion.findUnique({ where: { slug: item.slug } });
}

export async function persistDevotion(
  item: IngestedDevotion,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const existing = await findExistingDevotion(item);
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    // Spec: "only add content if it is not already in the database." Any
    // existing row is left untouched; ingestion is strictly additive.
    return {
      outcome: "skipped",
      slug: existing.slug,
      contentRef: existing.slug || existing.title,
      reason:
        existing.contentChecksum === incomingChecksum
          ? "duplicate content checksum"
          : "already in catalog",
    };
  }

  await prisma.devotion.create({
    data: {
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      practiceText: item.practiceText ?? null,
      durationMinutes: item.durationMinutes ?? null,
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
