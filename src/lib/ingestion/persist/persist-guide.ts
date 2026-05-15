import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedGuide } from "../types";
import type { PersistOutcomeDetailed } from "./persist-prayer";

/**
 * Upsert a SpiritualLifeGuide. Same conservative rules as the other
 * persisters: PUBLISHED / ARCHIVED rows are protected, identical-checksum
 * payloads are short-circuited as no-ops, and the externalSourceKey is the
 * preferred identity so the same upstream document never produces two rows.
 */
export async function persistGuide(
  item: IngestedGuide,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const existing = item.externalSourceKey
    ? await prisma.spiritualLifeGuide.findFirst({
        where: {
          OR: [{ externalSourceKey: item.externalSourceKey }, { slug: item.slug }],
        },
      })
    : await prisma.spiritualLifeGuide.findUnique({ where: { slug: item.slug } });

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

  await prisma.spiritualLifeGuide.create({
    data: {
      slug: item.slug,
      kind: item.guideKind,
      title: item.title,
      summary: item.summary,
      bodyText: item.bodyText ?? null,
      steps: item.steps ?? undefined,
      durationDays: item.durationDays ?? null,
      goalTemplateSlug: item.goalTemplateSlug ?? null,
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
