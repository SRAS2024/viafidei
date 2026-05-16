/**
 * Content version history. When an ingestion run detects an update
 * to an existing row (different checksum, same externalSourceKey),
 * the previous values are snapshotted into ContentVersion before the
 * update is applied. This gives the admin visibility into what
 * changed and supports a review workflow for major updates that
 * touch theology, official documents, saints, sacraments, or
 * doctrinal material.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const REVIEW_REQUIRED_ENTITY_TYPES: ReadonlyArray<string> = [
  "Saint",
  "LiturgyEntry",
  "SpiritualLifeGuide",
];

export type RecordVersionInput = {
  entityType: string;
  entityId: string;
  previousTitle?: string | null;
  previousBody?: string | null;
  previousChecksum?: string | null;
  previousStatus?: string | null;
  previousSource?: string | null;
  previousUpdatedAt?: Date | null;
  changeSummary?: string;
  reviewRequired?: boolean;
};

export function isReviewRequiredEntity(entityType: string): boolean {
  return REVIEW_REQUIRED_ENTITY_TYPES.includes(entityType);
}

export async function recordContentVersion(input: RecordVersionInput): Promise<void> {
  try {
    await prisma.contentVersion.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        previousTitle: input.previousTitle ?? null,
        previousBody: input.previousBody ?? null,
        previousChecksum: input.previousChecksum ?? null,
        previousStatus: input.previousStatus ?? null,
        previousSource: input.previousSource ?? null,
        previousUpdatedAt: input.previousUpdatedAt ?? null,
        changeSummary: input.changeSummary ?? null,
        reviewRequired: input.reviewRequired ?? isReviewRequiredEntity(input.entityType),
      },
    });
  } catch (e) {
    logger.warn("content.version.record_failed", {
      entityType: input.entityType,
      entityId: input.entityId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function listVersionsForEntity(
  entityType: string,
  entityId: string,
  take = 20,
): Promise<
  Array<{
    id: string;
    previousTitle: string | null;
    previousBody: string | null;
    previousChecksum: string | null;
    previousStatus: string | null;
    previousSource: string | null;
    previousUpdatedAt: Date | null;
    changeSummary: string | null;
    reviewRequired: boolean;
    createdAt: Date;
  }>
> {
  const rows = await prisma.contentVersion.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 100)),
  });
  return rows;
}
