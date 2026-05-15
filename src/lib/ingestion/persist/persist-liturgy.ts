import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedLiturgy } from "../types";
import type { PersistOutcomeDetailed } from "./persist-prayer";

/**
 * Upsert a liturgy / Church-history / council / catechetical entry. Uses
 * externalSourceKey when present (so the same upstream URL never produces
 * two rows) and falls back to slug. Curated rows (PUBLISHED / ARCHIVED) are
 * never overwritten — fresh ingestions on top of admin-edited content land
 * as DRAFT/REVIEW for re-curation.
 */
export async function persistLiturgy(
  item: IngestedLiturgy,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const existing = item.externalSourceKey
    ? await prisma.liturgyEntry.findFirst({
        where: {
          OR: [{ externalSourceKey: item.externalSourceKey }, { slug: item.slug }],
        },
      })
    : await prisma.liturgyEntry.findUnique({ where: { slug: item.slug } });

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

  await prisma.liturgyEntry.create({
    data: {
      slug: item.slug,
      kind: item.liturgyKind,
      title: item.title,
      summary: item.summary ?? null,
      body: item.body,
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
