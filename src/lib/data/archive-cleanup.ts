/**
 * Archive cleanup, version 2.
 *
 * Why a new file alongside `cleanup.ts`: the existing cleanup pass
 * keys on `updatedAt < cutoff` which is wrong — any edit, even a
 * janitor reformat after archiving, resets `updatedAt` and pushes the
 * row's effective deletion date forward. The fix is the dedicated
 * `archivedAt` column added in 0011_durable_ingestion_queue: cleanup
 * now uses `archivedAt < cutoff` so the one-month window starts from
 * the actual archive event, not the last write.
 *
 * Every hard delete also writes an ArchiveDeletionLog row with the
 * structured context the task spec requires (contentType, contentId,
 * archiveDate, deletionDate, reason, triggeredBy).
 */

import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { recordDataManagementLogs, type DataManagementLogInput } from "./data-management-log";

export const ARCHIVE_RETENTION_DAYS = 30;

export type ArchiveCleanupSummary = {
  buckets: Array<{ entity: string; deleted: number }>;
  totalDeleted: number;
};

type ContentTableKey =
  | "Prayer"
  | "Saint"
  | "MarianApparition"
  | "Devotion"
  | "LiturgyEntry"
  | "SpiritualLifeGuide"
  | "Parish";

/**
 * Mark a row as archived. Writes the `archivedAt` timestamp so the
 * retention math is durable and doesn't drift on every janitor pass.
 */
export async function markArchived(
  table: ContentTableKey,
  id: string,
  reason: string,
  triggeredBy: "automatic" | "manual" = "automatic",
  actorUsername: string | null = null,
): Promise<void> {
  const now = new Date();
  const data = { status: "ARCHIVED" as ContentStatus, archivedAt: now } as const;
  switch (table) {
    case "Prayer":
      await prisma.prayer.update({ where: { id }, data });
      break;
    case "Saint":
      await prisma.saint.update({ where: { id }, data });
      break;
    case "MarianApparition":
      await prisma.marianApparition.update({ where: { id }, data });
      break;
    case "Devotion":
      await prisma.devotion.update({ where: { id }, data });
      break;
    case "LiturgyEntry":
      await prisma.liturgyEntry.update({ where: { id }, data });
      break;
    case "SpiritualLifeGuide":
      await prisma.spiritualLifeGuide.update({ where: { id }, data });
      break;
    case "Parish":
      await prisma.parish.update({ where: { id }, data });
      break;
  }
  await recordDataManagementLogs([
    {
      action: "CLEANUP",
      contentType: table,
      contentRef: id,
      reason,
      triggeredBy,
      actorUsername,
    },
  ]);
}

/**
 * Hard-delete every archived row that has been in ARCHIVED status for
 * at least `retentionDays` days, measured from `archivedAt` (not
 * `updatedAt`). Writes one ArchiveDeletionLog row per row deleted.
 *
 * The implementation walks each entity table explicitly because
 * Prisma's delegate types are mutually exclusive — a generic helper
 * cannot get all delete + findMany signatures type-safe.
 */
export async function purgeArchivedByArchivedAt(
  retentionDays = ARCHIVE_RETENTION_DAYS,
  triggeredBy: "automatic" | "manual" = "automatic",
  actorUsername: string | null = null,
): Promise<ArchiveCleanupSummary> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { buckets: [], totalDeleted: 0 };
  }
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deletionLogs: Array<{
    contentType: string;
    contentId: string;
    contentSlug: string | null;
    archivedAt: Date | null;
    reason: string;
  }> = [];
  const dataLogs: DataManagementLogInput[] = [];
  const buckets: Array<{ entity: string; deleted: number }> = [];

  async function purgeTable(
    entity: ContentTableKey,
    findMany: () => Promise<Array<{ id: string; slug: string | null; archivedAt: Date | null }>>,
    deleteMany: () => Promise<{ count: number }>,
  ) {
    const targets = await findMany();
    for (const t of targets) {
      deletionLogs.push({
        contentType: entity,
        contentId: t.id,
        contentSlug: t.slug,
        archivedAt: t.archivedAt,
        reason: `Archived ≥ ${retentionDays} days (archivedAt-based purge)`,
      });
      dataLogs.push({
        action: "PURGE",
        contentType: entity,
        contentRef: t.slug ?? t.id,
        reason: `archivedAt ≥ ${retentionDays} days`,
        triggeredBy,
        actorUsername,
      });
    }
    const result = await deleteMany();
    buckets.push({ entity, deleted: result.count });
  }

  await purgeTable(
    "Prayer",
    () =>
      prisma.prayer.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.prayer.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "Saint",
    () =>
      prisma.saint.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.saint.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "MarianApparition",
    () =>
      prisma.marianApparition.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.marianApparition.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "Devotion",
    () =>
      prisma.devotion.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.devotion.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "LiturgyEntry",
    () =>
      prisma.liturgyEntry.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.liturgyEntry.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "SpiritualLifeGuide",
    () =>
      prisma.spiritualLifeGuide.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.spiritualLifeGuide.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );
  await purgeTable(
    "Parish",
    () =>
      prisma.parish.findMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
        select: { id: true, slug: true, archivedAt: true },
      }),
    () =>
      prisma.parish.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      }),
  );

  if (deletionLogs.length > 0) {
    await prisma.archiveDeletionLog.createMany({
      data: deletionLogs.map((d) => ({
        contentType: d.contentType,
        contentId: d.contentId,
        contentSlug: d.contentSlug,
        archivedAt: d.archivedAt,
        reason: d.reason,
        triggeredBy,
        actorUsername,
      })),
    });
    await recordDataManagementLogs(dataLogs);
  }

  const totalDeleted = buckets.reduce((sum, b) => sum + b.deleted, 0);
  return { buckets, totalDeleted };
}

/**
 * Admin reports need a stable monthly count of permanently-deleted
 * archive rows. Use ArchiveDeletionLog (not DataManagementLog) so the
 * value matches the dedicated audit table.
 */
export async function countArchiveDeletions(
  windowStart: Date,
  windowEnd: Date,
): Promise<Record<string, number>> {
  const rows = await prisma.archiveDeletionLog.groupBy({
    by: ["contentType"],
    where: { deletedAt: { gte: windowStart, lt: windowEnd } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.contentType] = row._count._all;
  }
  return out;
}

/**
 * Count of rows currently in ARCHIVED status, per content type.
 * Drives the admin "archived right now" metric (separate from the
 * "permanently deleted" metric above).
 */
export async function countCurrentlyArchived(): Promise<Record<string, number>> {
  const [prayers, saints, apparitions, devotions, liturgy, guides, parishes] = await Promise.all([
    prisma.prayer.count({ where: { status: "ARCHIVED" } }),
    prisma.saint.count({ where: { status: "ARCHIVED" } }),
    prisma.marianApparition.count({ where: { status: "ARCHIVED" } }),
    prisma.devotion.count({ where: { status: "ARCHIVED" } }),
    prisma.liturgyEntry.count({ where: { status: "ARCHIVED" } }),
    prisma.spiritualLifeGuide.count({ where: { status: "ARCHIVED" } }),
    prisma.parish.count({ where: { status: "ARCHIVED" } }),
  ]);
  return {
    Prayer: prayers,
    Saint: saints,
    MarianApparition: apparitions,
    Devotion: devotions,
    LiturgyEntry: liturgy,
    SpiritualLifeGuide: guides,
    Parish: parishes,
  };
}
