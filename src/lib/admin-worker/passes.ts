/**
 * Admin Worker pass lifecycle. A pass is one decide-then-act cycle of
 * the central loop. Each pass is recorded in AdminWorkerPass for the
 * diagnostics card pass breakdown and the monthly report.
 */

import type { AdminWorkerPassStatus, AdminWorkerPassType, PrismaClient } from "@prisma/client";

export interface StartPassInput {
  passType: AdminWorkerPassType;
}

export async function startPass(
  prisma: PrismaClient,
  input: StartPassInput,
): Promise<{ id: string; startedAt: Date }> {
  const row = await prisma.adminWorkerPass.create({
    data: {
      passType: input.passType,
      status: "RUNNING",
    },
  });
  return { id: row.id, startedAt: row.startedAt };
}

export interface CompletePassInput {
  passId: string;
  status?: AdminWorkerPassStatus;
  tasksPlanned?: number;
  tasksCompleted?: number;
  tasksFailed?: number;
  contentBuilt?: number;
  contentPublished?: number;
  contentRejected?: number;
  homepageActions?: number;
  securityActions?: number;
  diagnosticsResults?: Record<string, unknown>;
  summary?: string;
  errorMessage?: string;
}

export async function completePass(prisma: PrismaClient, input: CompletePassInput): Promise<void> {
  const started = await prisma.adminWorkerPass.findUnique({
    where: { id: input.passId },
    select: { startedAt: true },
  });
  const completedAt = new Date();
  const durationMs = started ? completedAt.getTime() - started.startedAt.getTime() : null;
  await prisma.adminWorkerPass.update({
    where: { id: input.passId },
    data: {
      status: input.status ?? "SUCCEEDED",
      completedAt,
      durationMs,
      tasksPlanned: input.tasksPlanned,
      tasksCompleted: input.tasksCompleted,
      tasksFailed: input.tasksFailed,
      contentBuilt: input.contentBuilt,
      contentPublished: input.contentPublished,
      contentRejected: input.contentRejected,
      homepageActions: input.homepageActions,
      securityActions: input.securityActions,
      diagnosticsResults: input.diagnosticsResults
        ? (input.diagnosticsResults as object)
        : undefined,
      summary: input.summary,
      errorMessage: input.errorMessage,
    },
  });
}

export async function listRecentPasses(
  prisma: PrismaClient,
  opts: { limit?: number; passType?: AdminWorkerPassType } = {},
) {
  return prisma.adminWorkerPass.findMany({
    where: opts.passType ? { passType: opts.passType } : undefined,
    orderBy: { startedAt: "desc" },
    take: opts.limit ?? 25,
  });
}

/**
 * Stale-pass reaper. A pass row is created RUNNING at the top of the loop and
 * only reaches a terminal status (SUCCEEDED / PARTIAL / FAILED) when the pass
 * finishes. If the worker process is killed mid-pass — OOM, deploy, SIGKILL,
 * an uncaught throw before the loop's own error path runs — the row is orphaned
 * as RUNNING forever, which is exactly the "Last pass … (status: RUNNING)" the
 * developer audit flagged. It also poisons liveness heuristics that treat a
 * RUNNING row as "a pass is in flight".
 *
 * Called once at worker startup (and cheap enough to call opportunistically):
 * any pass still RUNNING past `staleMs` (default 10 min, matching the UI's
 * worker-live cutoff) cannot belong to this fresh process, so it is marked
 * FAILED with a clear reason. Fail-open — a reaper error must never block boot.
 *
 * @returns the number of stale passes reaped.
 */
export async function reapStaleRunningPasses(
  prisma: PrismaClient,
  opts: { staleMs?: number } = {},
): Promise<number> {
  const staleMs = opts.staleMs ?? 10 * 60 * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  try {
    const now = new Date();
    const result = await prisma.adminWorkerPass.updateMany({
      where: { status: "RUNNING", startedAt: { lt: cutoff } },
      data: {
        status: "FAILED",
        completedAt: now,
        errorMessage: "reaped: pass left RUNNING (worker likely crashed or was killed mid-pass)",
        summary: "reaped stale RUNNING pass at worker startup",
      },
    });
    return result.count;
  } catch {
    // Fail-open — never block worker boot on a reaper error.
    return 0;
  }
}
