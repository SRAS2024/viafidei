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
