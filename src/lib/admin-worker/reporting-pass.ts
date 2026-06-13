/**
 * Periodic reporting pass.
 *
 * Records a growth snapshot per content type and the per-content-type source
 * coverage scorecard, so the Developer Audit's "Growth orchestrator" and
 * "Source coverage" checks reflect live state instead of warning "0 snapshots /
 * no coverage scored yet". As a side effect the growth orchestrator also files a
 * high-priority repair plan for any content type that has stalled (no growth in
 * 7 days) and moves goals that are met into maintenance — so the worker keeps
 * pressure on the types that are behind.
 *
 * Self-throttled (~hourly) so the loop can call it every pass for free; the
 * snapshot/coverage rows would otherwise pile up at the ~15s pass cadence.
 * Best-effort / fail-open — reporting must never break a worker pass.
 */

import type { PrismaClient } from "@prisma/client";

import { runGrowthOrchestrator } from "./growth-orchestrator";
import { runSourceCoverage } from "./source-coverage";

const THROTTLE_MS = 60 * 60 * 1000; // hourly
const THROTTLE_KEY = "reporting-pass-lastrun";

export interface ReportingPassResult {
  ran: boolean;
  growthAssessed: number;
  repairPlansFiled: number;
  coverageRows: number;
}

async function throttleOk(prisma: PrismaClient, force: boolean): Promise<boolean> {
  if (force) return true;
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

/**
 * Run one reporting pass (growth snapshots + source coverage), throttled to ~1/h.
 * Returns `ran:false` when throttled. Fail-open on every sub-step.
 */
export async function maybeRunReportingPass(
  prisma: PrismaClient,
  opts: { passId?: string; force?: boolean } = {},
): Promise<ReportingPassResult> {
  const out: ReportingPassResult = {
    ran: false,
    growthAssessed: 0,
    repairPlansFiled: 0,
    coverageRows: 0,
  };
  if (!(await throttleOk(prisma, opts.force ?? false))) return out;
  out.ran = true;

  const growth = await runGrowthOrchestrator(prisma, { passId: opts.passId }).catch(() => null);
  if (growth) {
    out.growthAssessed = growth.assessments.length;
    out.repairPlansFiled = growth.repairPlansFiled;
  }

  const coverage = await runSourceCoverage(prisma).catch(() => null);
  if (coverage) out.coverageRows = coverage.length;

  return out;
}
