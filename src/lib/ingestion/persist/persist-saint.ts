import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedSaint } from "../types";
import type { PersistOutcome } from "./persist-prayer";

async function findExistingSaint(item: IngestedSaint) {
  if (item.externalSourceKey) {
    const byKey = await prisma.saint.findUnique({
      where: { externalSourceKey: item.externalSourceKey },
    });
    if (byKey) return byKey;
  }
  return prisma.saint.findUnique({ where: { slug: item.slug } });
}

export async function persistSaint(
  item: IngestedSaint,
  initialStatus: ContentStatus,
): Promise<PersistOutcome> {
  const existing = await findExistingSaint(item);
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.saint.update({
      where: { id: existing.id },
      data: {
        canonicalName: item.canonicalName,
        feastDay: item.feastDay ?? null,
        patronages: item.patronages,
        biography: item.biography,
        officialPrayer: item.officialPrayer ?? null,
        externalSourceKey: item.externalSourceKey ?? existing.externalSourceKey ?? null,
        contentChecksum: incomingChecksum,
      },
    });
    return "updated";
  }

  await prisma.saint.create({
    data: {
      slug: item.slug,
      canonicalName: item.canonicalName,
      feastDay: item.feastDay ?? null,
      patronages: item.patronages,
      biography: item.biography,
      officialPrayer: item.officialPrayer ?? null,
      externalSourceKey: item.externalSourceKey ?? null,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return "created";
}
