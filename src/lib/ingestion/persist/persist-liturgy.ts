import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { snapshotPreviousVersion } from "../apply-decision";
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
    // Content-freshness check for Church documents: a new version of
    // an encyclical / catechism section / canon law book lands as an
    // UPDATE with the previous version snapshotted into
    // ContentVersion (reviewRequired = true so a moderator approves
    // doctrinal changes).
    const checksumDiffers =
      !!existing.contentChecksum && existing.contentChecksum !== incomingChecksum;
    const sameExternalKey =
      !!item.externalSourceKey && existing.externalSourceKey === item.externalSourceKey;
    const isAdminProtected = existing.status === "ARCHIVED" || existing.status === "DRAFT";
    if (checksumDiffers && sameExternalKey && !isAdminProtected) {
      await snapshotPreviousVersion(
        "liturgy",
        existing,
        incomingChecksum,
        item.externalSourceKey ?? null,
      );
      await prisma.liturgyEntry.update({
        where: { id: existing.id },
        data: {
          title: item.title,
          summary: item.summary ?? existing.summary,
          body: item.body,
          contentChecksum: incomingChecksum,
        },
      });
      return {
        outcome: "updated",
        slug: existing.slug,
        contentRef: existing.slug || existing.title,
        reason: "Upstream content changed — updated in place + version snapshotted",
      };
    }
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
