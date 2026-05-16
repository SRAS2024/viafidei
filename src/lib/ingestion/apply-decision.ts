/**
 * After the persister writes a row, this helper applies the
 * per-item decision (sourceConfidence / formattingConfidence /
 * qualityScore / theologicalReviewFlag / sourceTier /
 * outcomeReason) and snapshots the previous version into
 * ContentVersion when an update was detected.
 *
 * The persisters themselves stay focused on the
 * find / upsert / dedup logic and we apply the new scoring
 * columns in a single follow-up update keyed by slug. This
 * keeps the kind-specific code small and means new scoring
 * columns only require touching one helper.
 */

import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { recordContentVersion, isReviewRequiredEntity } from "../content/version-history";
import type { EnrichedDecision } from "./enrich-decision";

type EntityType =
  | "Prayer"
  | "Saint"
  | "MarianApparition"
  | "Devotion"
  | "LiturgyEntry"
  | "SpiritualLifeGuide"
  | "Parish";

const ENTITY_BY_KIND: Record<string, EntityType> = {
  prayer: "Prayer",
  saint: "Saint",
  apparition: "MarianApparition",
  devotion: "Devotion",
  liturgy: "LiturgyEntry",
  guide: "SpiritualLifeGuide",
  parish: "Parish",
};

async function updateScores(entity: EntityType, slug: string, data: Record<string, unknown>) {
  switch (entity) {
    case "Prayer":
      return prisma.prayer.update({ where: { slug }, data });
    case "Saint":
      return prisma.saint.update({ where: { slug }, data });
    case "MarianApparition":
      return prisma.marianApparition.update({ where: { slug }, data });
    case "Devotion":
      return prisma.devotion.update({ where: { slug }, data });
    case "LiturgyEntry":
      return prisma.liturgyEntry.update({ where: { slug }, data });
    case "SpiritualLifeGuide":
      return prisma.spiritualLifeGuide.update({ where: { slug }, data });
    case "Parish":
      return prisma.parish.update({ where: { slug }, data });
  }
}

/**
 * Apply the enrich-decision scores onto the persisted row keyed by
 * slug. Silently skipped on error so the runner's per-item loop
 * keeps moving — a failure here never invalidates an otherwise-
 * successful persist.
 */
export async function applyDecisionScores(
  kind: string,
  slug: string,
  decision: EnrichedDecision,
  status: ContentStatus,
): Promise<void> {
  const entity = ENTITY_BY_KIND[kind];
  if (!entity) return;
  try {
    await updateScores(entity, slug, {
      sourceConfidence: decision.sourceConfidence,
      formattingConfidence: decision.formattingConfidence,
      qualityScore: decision.qualityScore,
      theologicalReviewFlag: decision.theologicalReviewFlag,
      sourceTier: decision.sourceTier,
      outcomeReason: decision.outcomeReason,
      // archivedAt is set when status flips to ARCHIVED. If a row is
      // re-published, clear archivedAt so the next purge cycle does
      // not delete it.
      ...(status === "ARCHIVED" ? { archivedAt: new Date() } : { archivedAt: null }),
    });
  } catch (e) {
    logger.warn("ingestion.apply_decision.failed", {
      kind,
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Snapshot the previous version of a row into ContentVersion before
 * an upcoming update. Caller passes the row it just `findUnique`'d
 * so we can capture all the relevant fields without re-reading.
 */
export async function snapshotPreviousVersion(
  kind: string,
  previousRow: {
    id: string;
    contentChecksum?: string | null;
    status?: ContentStatus | null;
    updatedAt?: Date | null;
  } & Record<string, unknown>,
  newChecksum: string,
  newSource: string | null,
): Promise<void> {
  const entityType = ENTITY_BY_KIND[kind];
  if (!entityType) return;
  // Only snapshot when the checksum actually changed — avoid logging
  // identical re-runs as "updates" in version history.
  if (previousRow.contentChecksum === newChecksum) return;
  const previousTitle =
    (previousRow as { defaultTitle?: string }).defaultTitle ??
    (previousRow as { canonicalName?: string }).canonicalName ??
    (previousRow as { title?: string }).title ??
    (previousRow as { name?: string }).name ??
    null;
  const previousBody =
    (previousRow as { body?: string }).body ??
    (previousRow as { biography?: string }).biography ??
    (previousRow as { summary?: string }).summary ??
    (previousRow as { bodyText?: string }).bodyText ??
    null;
  await recordContentVersion({
    entityType,
    entityId: previousRow.id,
    previousTitle,
    previousBody,
    previousChecksum: previousRow.contentChecksum ?? null,
    previousStatus: previousRow.status ?? null,
    previousSource: newSource ?? null,
    previousUpdatedAt: previousRow.updatedAt ?? null,
    changeSummary: `Checksum changed: ${previousRow.contentChecksum ?? "none"} → ${newChecksum}`,
    reviewRequired: isReviewRequiredEntity(entityType),
  });
}
