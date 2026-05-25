/**
 * AdminWorkerPipelineStage helpers (spec §4). One row per item moving
 * through the content chain — the diagnostics card uses these rows to
 * surface exactly where each item is stuck.
 */

import type {
  AdminWorkerPipelineStageName,
  AdminWorkerPipelineStageStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export const PIPELINE_ORDER: ReadonlyArray<AdminWorkerPipelineStageName> = [
  "DISCOVERY",
  "CANDIDATE",
  "FETCH",
  "READ",
  "CLASSIFY",
  "CHECKLIST_ITEM",
  "CITATION",
  "BUILD_JOB",
  "BUILD_PACKAGE",
  "VALIDATE",
  "QA",
  "PUBLISH",
  "POST_PUBLISH_VERIFY",
  "SEARCH_INDEX",
  "SITEMAP",
  "CACHE",
] as const;

export function nextStage(
  current: AdminWorkerPipelineStageName,
): AdminWorkerPipelineStageName | null {
  const idx = PIPELINE_ORDER.indexOf(current);
  if (idx < 0 || idx === PIPELINE_ORDER.length - 1) return null;
  return PIPELINE_ORDER[idx + 1];
}

export interface RecordStageInput {
  stageName: AdminWorkerPipelineStageName;
  status?: AdminWorkerPipelineStageStatus;
  contentType?: string;
  inputId?: string;
  outputId?: string;
  failureReason?: string;
  repairRecommendation?: string;
  confidenceScore?: number;
  metadata?: Prisma.InputJsonValue;
}

export async function recordStage(
  prisma: PrismaClient,
  input: RecordStageInput,
): Promise<{ id: string }> {
  const now = new Date();
  const status = input.status ?? "PENDING";
  const row = await prisma.adminWorkerPipelineStage.create({
    data: {
      stageName: input.stageName,
      status,
      contentType: input.contentType,
      inputId: input.inputId,
      outputId: input.outputId,
      startedAt: status === "RUNNING" || status === "SUCCEEDED" || status === "FAILED" ? now : null,
      completedAt:
        status === "SUCCEEDED" || status === "FAILED" || status === "SKIPPED" ? now : null,
      failureReason: input.failureReason,
      repairRecommendation: input.repairRecommendation,
      confidenceScore: input.confidenceScore ?? 0,
      metadata: input.metadata,
    },
    select: { id: true },
  });
  return row;
}

export async function completeStage(
  prisma: PrismaClient,
  id: string,
  input: {
    status: AdminWorkerPipelineStageStatus;
    outputId?: string;
    failureReason?: string;
    confidenceScore?: number;
  },
): Promise<void> {
  await prisma.adminWorkerPipelineStage.update({
    where: { id },
    data: {
      status: input.status,
      outputId: input.outputId,
      failureReason: input.failureReason,
      confidenceScore: input.confidenceScore,
      completedAt: new Date(),
    },
  });
}

/**
 * Snapshot for the diagnostics card: counts per stage + counts per
 * status so the operator can see exactly where the chain is bottlenecked.
 */
export async function pipelineSnapshot(prisma: PrismaClient): Promise<
  Array<{
    stage: AdminWorkerPipelineStageName;
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    blocked: number;
  }>
> {
  const grouped = await prisma.adminWorkerPipelineStage.groupBy({
    by: ["stageName", "status"],
    _count: true,
  });
  const out = PIPELINE_ORDER.map((stage) => ({
    stage,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    blocked: 0,
  }));
  const byStage = new Map(out.map((row) => [row.stage, row]));
  for (const g of grouped) {
    const row = byStage.get(g.stageName);
    if (!row) continue;
    const count = g._count as number;
    switch (g.status) {
      case "PENDING":
        row.pending = count;
        break;
      case "RUNNING":
        row.running = count;
        break;
      case "SUCCEEDED":
        row.succeeded = count;
        break;
      case "FAILED":
        row.failed = count;
        break;
      case "BLOCKED":
        row.blocked = count;
        break;
    }
  }
  return out;
}
