import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedApparition } from "../types";
import type { PersistOutcome } from "./persist-prayer";

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
): Promise<PersistOutcome> {
  const existing = await findExistingApparition(item);
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.marianApparition.update({
      where: { id: existing.id },
      data: {
        title: item.title,
        location: item.location ?? null,
        country: item.country ?? null,
        approvedStatus: item.approvedStatus,
        summary: item.summary,
        officialPrayer: item.officialPrayer ?? null,
        externalSourceKey:
          item.externalSourceKey ?? existing.externalSourceKey ?? null,
        contentChecksum: incomingChecksum,
      },
    });
    return "updated";
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
  return "created";
}
