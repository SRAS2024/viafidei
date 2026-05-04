import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedGuide } from "../types";

export type PersistOutcome = "created" | "updated" | "skipped";

/**
 * Upsert a SpiritualLifeGuide. Same conservative rules as the other
 * persisters: PUBLISHED / ARCHIVED rows are protected, identical-checksum
 * payloads are short-circuited as no-ops, and the externalSourceKey is the
 * preferred identity so the same upstream document never produces two rows.
 */
export async function persistGuide(
  item: IngestedGuide,
  initialStatus: ContentStatus,
): Promise<PersistOutcome> {
  const existing = item.externalSourceKey
    ? await prisma.spiritualLifeGuide.findFirst({
        where: {
          OR: [{ externalSourceKey: item.externalSourceKey }, { slug: item.slug }],
        },
      })
    : await prisma.spiritualLifeGuide.findUnique({ where: { slug: item.slug } });

  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.spiritualLifeGuide.update({
      where: { id: existing.id },
      data: {
        kind: item.guideKind,
        title: item.title,
        summary: item.summary,
        bodyText: item.bodyText ?? null,
        steps: item.steps ?? undefined,
        durationDays: item.durationDays ?? null,
        goalTemplateSlug: item.goalTemplateSlug ?? null,
        externalSourceKey: item.externalSourceKey ?? existing.externalSourceKey,
        contentChecksum: incomingChecksum,
        status: initialStatus,
      },
    });
    return "updated";
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
  return "created";
}
