import type { ContentStatus } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeChecksum } from "../checksum";
import { normalizeSlug } from "../slug";
import type { IngestedPrayer } from "../types";

export type PersistOutcome = "created" | "updated" | "skipped";

/**
 * Detailed outcome reported back to the runner so it can write
 * accurate DataManagementLog rows (with the reason for a skip, the
 * slug that ended up created / updated, and so on).
 */
export type PersistOutcomeDetailed = {
  outcome: PersistOutcome;
  slug: string;
  /** Title / display ref for the log row when slug is awkward. */
  contentRef: string;
  /** Set when outcome is "skipped" — why the row was left untouched. */
  reason?: string;
};

export async function persistPrayer(
  item: IngestedPrayer,
  initialStatus: ContentStatus,
): Promise<PersistOutcomeDetailed> {
  const incomingChecksum = computeChecksum(item);
  const normalizedTitle = normalizeSlug(item.defaultTitle);
  const orMatchers: Array<Record<string, unknown>> = [{ slug: item.slug }];
  if (item.externalSourceKey) {
    orMatchers.push({ externalSourceKey: item.externalSourceKey });
  }
  // Body-level dedup: identical content checksum means same prayer body.
  orMatchers.push({ contentChecksum: incomingChecksum });
  if (normalizedTitle) {
    // Match a different existing row whose slug was generated from the
    // same normalized title (covers accent / spacing variants) and whose
    // displayed title is byte-identical.
    orMatchers.push({ slug: normalizedTitle });
    orMatchers.push({ defaultTitle: item.defaultTitle });
  }
  const existing = await prisma.prayer.findFirst({
    where: { OR: orMatchers },
  });

  if (existing) {
    // Spec: "only add content if it is not already in the database."
    // Any existing row — whether already PUBLISHED, ARCHIVED, DRAFT (admin
    // WIP), or REVIEW — is left untouched. Ingestion is strictly additive:
    // it never overwrites a row the admin is or was working on, and it never
    // re-writes its own previous output (that's what `dedupeBatch` + the
    // checksum lookup are for).
    return {
      outcome: "skipped",
      slug: existing.slug,
      contentRef: existing.slug || existing.defaultTitle,
      reason:
        existing.contentChecksum === incomingChecksum
          ? "duplicate content checksum"
          : "already in catalog",
    };
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
  return {
    outcome: "created",
    slug: item.slug,
    contentRef: item.slug || item.defaultTitle,
  };
}
