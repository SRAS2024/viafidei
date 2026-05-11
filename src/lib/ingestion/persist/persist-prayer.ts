import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedPrayer } from "../types";

export type PersistOutcome = "created" | "updated" | "skipped";

export async function persistPrayer(
  item: IngestedPrayer,
  initialStatus: ContentStatus,
): Promise<PersistOutcome> {
  const incomingChecksum = computeChecksum(item);
  const normalizedTitle = normalizeSlug(item.defaultTitle);
  const orMatchers: Array<Record<string, unknown>> = [{ slug: item.slug }];
  if (item.externalSourceKey) {
    orMatchers.push({ externalSourceKey: item.externalSourceKey });
  }
  orMatchers.push({ contentChecksum: incomingChecksum });
  if (normalizedTitle) {
    orMatchers.push({ slug: normalizedTitle });
    orMatchers.push({ defaultTitle: item.defaultTitle });
  }
  const existing = await prisma.prayer.findFirst({
    where: { OR: orMatchers },
  });

  if (existing) {
    // Curated (PUBLISHED/ARCHIVED) content is protected from automatic overwrites
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
        externalSourceKey: item.externalSourceKey ?? existing.externalSourceKey,
        contentChecksum: incomingChecksum,
        status: initialStatus,
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
      externalSourceKey: item.externalSourceKey ?? null,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return "created";
}
