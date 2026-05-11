import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedSaint } from "../types";
import type { PersistOutcome } from "./persist-prayer";

async function findExistingSaint(item: IngestedSaint) {
  if (item.externalSourceKey) {
    const byKey = await prisma.saint.findUnique({
      where: { externalSourceKey: item.externalSourceKey },
    });
    if (byKey) return byKey;
  }
  const bySlug = await prisma.saint.findUnique({ where: { slug: item.slug } });
  if (bySlug) return bySlug;
  // Same person re-encountered with a different slug variant (accents,
  // spacing, suffixes) — match on the slug-normalized canonical name so
  // we never insert "saint-anthony-of-padua" twice.
  const normalized = normalizeSlug(item.canonicalName);
  if (normalized) {
    const byName = await prisma.saint.findFirst({
      where: { OR: [{ slug: normalized }, { canonicalName: item.canonicalName }] },
    });
    if (byName) return byName;
  }
  return null;
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
        status: initialStatus,
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
