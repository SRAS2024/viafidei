import { prisma } from "../db/client";

/**
 * One-time migration to promote legacy auto-ingested orphans to PUBLISHED.
 *
 * Previous deploys had `appConfig.ingestion.initialStatus = "REVIEW"`, so
 * every prayer / saint / parish / etc. that the ingestion pipeline pulled
 * landed as REVIEW and never appeared on the public site until an admin
 * manually approved each one. With the new rule (ingestion auto-publishes,
 * admin manual edits drop to DRAFT) those stuck REVIEW rows would otherwise
 * remain invisible forever.
 *
 * The migration identifies rows that came from the ingestion pipeline by
 * the presence of `externalSourceKey` and promotes them only if they are
 * still in REVIEW status. DRAFT / ARCHIVED rows are left alone because
 * those are intentional admin states. PUBLISHED rows are already correct.
 *
 * Each upsert is independent; failure to migrate one model doesn't block
 * the others. The function is idempotent — re-running it after success
 * touches zero rows.
 */
export async function promoteIngestedOrphans(): Promise<{
  prayers: number;
  saints: number;
  parishes: number;
  apparitions: number;
  devotions: number;
  liturgyEntries: number;
  guides: number;
}> {
  const filter = { status: "REVIEW" as const, externalSourceKey: { not: null } };
  const [prayers, saints, parishes, apparitions, devotions, liturgyEntries, guides] =
    await Promise.all([
      prisma.prayer
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.saint
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.parish
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.marianApparition
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.devotion
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.liturgyEntry
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
      prisma.spiritualLifeGuide
        .updateMany({ where: filter, data: { status: "PUBLISHED" } })
        .then((r) => r.count)
        .catch(() => 0),
    ]);
  return { prayers, saints, parishes, apparitions, devotions, liturgyEntries, guides };
}
