import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedPrayer } from "../types";

export type PersistOutcome = "created" | "updated" | "skipped";

export async function persistPrayer(
  item: IngestedPrayer,
  initialStatus: ContentStatus,
): Promise<PersistOutcome> {
  const existing = await prisma.prayer.findUnique({ where: { slug: item.slug } });
  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.prayer.update({
      where: { id: existing.id },
      data: {
        defaultTitle: item.defaultTitle,
        category: item.category,
        body: item.body,
        contentChecksum: incomingChecksum,
      },
    });
    return "updated";
  }

  await prisma.prayer.create({
    data: {
      slug: item.slug,
      defaultTitle: item.defaultTitle,
      body: item.body,
      category: item.category,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return "created";
}
