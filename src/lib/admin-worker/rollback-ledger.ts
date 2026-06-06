/**
 * Durable rollback ledger (spec: "add rollback guarantees"). Every
 * post-publish rollback writes one row capturing what was rolled back,
 * why, what action was taken, and whether it can be safely restored.
 * Surfaced in Admin Worker diagnostics and the Developer Audit so
 * autonomy stays safe and reversible.
 */

import type { PrismaClient } from "@prisma/client";

export interface RollbackLedgerInput {
  contentId?: string | null;
  contentType?: string | null;
  slug?: string | null;
  /** The public state before the rollback (e.g. "PUBLISHED"). */
  previousPublicState: string;
  failedVerificationReason?: string | null;
  rollbackAction: string;
  relatedPackageArtifactId?: string | null;
  relatedRepairPlanId?: string | null;
  humanReviewCreated?: boolean;
  /** The terminal rollback decision (REPAIRED/UNPUBLISHED/DELETED/HUMAN_REVIEW). */
  rollbackResult: string;
  /** Whether the row can be safely restored later. */
  restorable?: boolean;
  passId?: string | null;
}

export async function recordRollbackLedger(
  prisma: PrismaClient,
  input: RollbackLedgerInput,
): Promise<void> {
  // Best-effort: the ledger must never break the rollback path itself.
  try {
    await prisma.adminWorkerRollbackLedger.create({
      data: {
        contentId: input.contentId ?? null,
        contentType: input.contentType ?? null,
        slug: input.slug ?? null,
        previousPublicState: input.previousPublicState,
        failedVerificationReason: input.failedVerificationReason ?? null,
        rollbackAction: input.rollbackAction,
        relatedPackageArtifactId: input.relatedPackageArtifactId ?? null,
        relatedRepairPlanId: input.relatedRepairPlanId ?? null,
        humanReviewCreated: input.humanReviewCreated ?? false,
        rollbackResult: input.rollbackResult,
        restorable: input.restorable ?? false,
        passId: input.passId ?? null,
      },
    });
  } catch {
    /* ignore */
  }
}

export interface RollbackLedgerRow {
  id: string;
  contentId: string | null;
  contentType: string | null;
  slug: string | null;
  previousPublicState: string;
  failedVerificationReason: string | null;
  rollbackAction: string;
  humanReviewCreated: boolean;
  rollbackResult: string;
  restorable: boolean;
  createdAt: Date;
}

export async function listRecentRollbacks(
  prisma: PrismaClient,
  opts: { limit?: number; sinceHours?: number } = {},
): Promise<RollbackLedgerRow[]> {
  const where = opts.sinceHours
    ? { createdAt: { gte: new Date(Date.now() - opts.sinceHours * 3600_000) } }
    : {};
  return prisma.adminWorkerRollbackLedger
    .findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 25,
      select: {
        id: true,
        contentId: true,
        contentType: true,
        slug: true,
        previousPublicState: true,
        failedVerificationReason: true,
        rollbackAction: true,
        humanReviewCreated: true,
        rollbackResult: true,
        restorable: true,
        createdAt: true,
      },
    })
    .catch(() => []);
}
