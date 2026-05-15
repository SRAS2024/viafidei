import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { parseFeastDayText } from "../../data/saints";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedSaint } from "../types";
import type { PersistOutcomeDetailed } from "./persist-prayer";

async function findExistingSaint(item: IngestedSaint, incomingChecksum: string) {
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
  // Body-level dedup: same biography text from two different upstream URLs
  // produces the same content checksum — collapse them onto one row.
  const byChecksum = await prisma.saint.findFirst({
    where: { contentChecksum: incomingChecksum },
  });
  if (byChecksum) return byChecksum;
  return null;
}

export async function persistSaint(
  item: IngestedSaint,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const incomingChecksum = computeChecksum(item);
  const existing = await findExistingSaint(item, incomingChecksum);

  if (existing) {
    // Spec: "only add content if it is not already in the database." Any
    // existing row — PUBLISHED, ARCHIVED, DRAFT (admin WIP), or REVIEW —
    // is left untouched; ingestion is strictly additive.
    return {
      outcome: "skipped",
      slug: existing.slug,
      contentRef: existing.slug || existing.canonicalName,
      reason:
        existing.contentChecksum === incomingChecksum
          ? "duplicate content checksum"
          : "already in catalog",
    };
  }

  const parsed = parseFeastDayText(item.feastDay);
  const feastMonth = item.feastMonth ?? parsed?.month ?? null;
  const feastDayOfMonth = item.feastDayOfMonth ?? parsed?.day ?? null;

  await prisma.saint.create({
    data: {
      slug: item.slug,
      canonicalName: item.canonicalName,
      feastDay: item.feastDay ?? null,
      feastMonth,
      feastDayOfMonth,
      patronages: item.patronages,
      biography: item.biography,
      officialPrayer: item.officialPrayer ?? null,
      externalSourceKey: item.externalSourceKey ?? null,
      contentChecksum: incomingChecksum,
      status: initialStatus,
    },
  });
  return {
    outcome: "created",
    slug: item.slug,
    contentRef: item.slug || item.canonicalName,
  };
}
