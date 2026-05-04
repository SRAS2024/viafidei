import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import type { IngestedLiturgy } from "../types";

export type PersistOutcome = "created" | "updated" | "skipped";

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
): Promise<PersistOutcome> {
  const existing = item.externalSourceKey
    ? await prisma.liturgyEntry.findFirst({
        where: {
          OR: [{ externalSourceKey: item.externalSourceKey }, { slug: item.slug }],
        },
      })
    : await prisma.liturgyEntry.findUnique({ where: { slug: item.slug } });

  const incomingChecksum = computeChecksum(item);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "ARCHIVED") {
      return "skipped";
    }
    if (existing.contentChecksum === incomingChecksum) return "skipped";
    await prisma.liturgyEntry.update({
      where: { id: existing.id },
      data: {
        kind: item.liturgyKind,
        title: item.title,
        summary: item.summary ?? null,
        body: item.body,
        externalSourceKey: item.externalSourceKey ?? existing.externalSourceKey,
        contentChecksum: incomingChecksum,
        status: initialStatus,
      },
    });
    return "updated";
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
  return "created";
}
