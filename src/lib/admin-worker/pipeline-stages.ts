/**
 * AdminWorkerPipelineStage helpers (spec §3, §4). One row per item
 * moving through the content chain — the diagnostics card uses these
 * rows to surface exactly where each item is stuck.
 *
 * Spec §3 adds two new behaviours on top of the basic stage log:
 *
 *   1. pipelineKey ties stages together so we can render a per-item
 *      pipeline map (Discovery → … → Cache). The brain follows the
 *      key when resuming work on the next pass.
 *
 *   2. Checksum-based skip: a stage row carries inputChecksum and
 *      outputChecksum. When the brain reaches a stage for a key whose
 *      most recent SUCCEEDED row has the same inputChecksum as the
 *      current input, the stage is skipped — we don't redo work that
 *      would produce the same answer.
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
  pipelineKey?: string;
  candidateUrlId?: string;
  sourceReadId?: string;
  packageId?: string;
  publishedContentId?: string;
  inputId?: string;
  outputId?: string;
  inputChecksum?: string;
  outputChecksum?: string;
  failureReason?: string;
  repairRecommendation?: string;
  confidenceScore?: number;
  qualityScore?: number;
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
      pipelineKey: input.pipelineKey,
      candidateUrlId: input.candidateUrlId,
      sourceReadId: input.sourceReadId,
      packageId: input.packageId,
      publishedContentId: input.publishedContentId,
      inputId: input.inputId,
      outputId: input.outputId,
      inputChecksum: input.inputChecksum,
      outputChecksum: input.outputChecksum,
      startedAt: status === "RUNNING" || status === "SUCCEEDED" || status === "FAILED" ? now : null,
      completedAt:
        status === "SUCCEEDED" || status === "FAILED" || status === "SKIPPED" ? now : null,
      failureReason: input.failureReason,
      repairRecommendation: input.repairRecommendation,
      confidenceScore: input.confidenceScore ?? 0,
      qualityScore: input.qualityScore ?? 0,
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
    outputChecksum?: string;
    failureReason?: string;
    confidenceScore?: number;
    qualityScore?: number;
  },
): Promise<void> {
  await prisma.adminWorkerPipelineStage.update({
    where: { id },
    data: {
      status: input.status,
      outputId: input.outputId,
      outputChecksum: input.outputChecksum,
      failureReason: input.failureReason,
      confidenceScore: input.confidenceScore,
      qualityScore: input.qualityScore,
      completedAt: new Date(),
    },
  });
}

/**
 * Decide what to do for a stage on a pipelineKey:
 *
 *   - "skip"   the most recent SUCCEEDED row for this key + stage has
 *              the same inputChecksum we'd write now, so the stage is
 *              already complete and we don't redo it.
 *   - "resume" a PENDING / RUNNING row exists — keep the row and
 *              continue the existing attempt.
 *   - "run"   the stage has never been attempted for this key, or
 *              the input has changed since the last success. The
 *              caller should create a new row.
 *
 * Spec §3:
 *   "The worker should resume incomplete pipeline items on the next
 *    pass. The worker should not redo completed stages unless the
 *    source checksum or package contract version changed."
 */
export type ResumeDecision =
  | { action: "skip"; rowId: string; reason: string }
  | { action: "resume"; rowId: string; reason: string }
  | { action: "run"; reason: string };

export async function resumeOrAdvance(
  prisma: PrismaClient,
  opts: {
    stageName: AdminWorkerPipelineStageName;
    pipelineKey: string;
    inputChecksum?: string;
  },
): Promise<ResumeDecision> {
  if (!opts.pipelineKey) {
    return { action: "run", reason: "no pipelineKey provided" };
  }
  const rows = await prisma.adminWorkerPipelineStage.findMany({
    where: { pipelineKey: opts.pipelineKey, stageName: opts.stageName },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (rows.length === 0) {
    return { action: "run", reason: "no prior attempt for this stage" };
  }
  const inflight = rows.find((r) => r.status === "PENDING" || r.status === "RUNNING");
  if (inflight) {
    return { action: "resume", rowId: inflight.id, reason: "in-flight attempt exists" };
  }
  const lastSuccess = rows.find((r) => r.status === "SUCCEEDED");
  if (
    lastSuccess &&
    opts.inputChecksum &&
    lastSuccess.inputChecksum &&
    lastSuccess.inputChecksum === opts.inputChecksum
  ) {
    return {
      action: "skip",
      rowId: lastSuccess.id,
      reason: "inputChecksum matches prior success",
    };
  }
  return { action: "run", reason: "input changed or no successful attempt yet" };
}

/**
 * Find the most recent row for a pipelineKey across all stages. Used
 * by the dispatcher to figure out which stage to advance next.
 */
export async function latestStageFor(
  prisma: PrismaClient,
  pipelineKey: string,
): Promise<{
  stageName: AdminWorkerPipelineStageName;
  status: AdminWorkerPipelineStageStatus;
  id: string;
} | null> {
  const row = await prisma.adminWorkerPipelineStage.findFirst({
    where: { pipelineKey },
    orderBy: { createdAt: "desc" },
    select: { id: true, stageName: true, status: true },
  });
  return row;
}

/**
 * Render a per-pipelineKey map (Discovery → Cache) showing the
 * status of each stage for one content item. Used by the admin UI
 * to surface "where is this item stuck?" without rerunning anything.
 */
export async function pipelineMapFor(
  prisma: PrismaClient,
  pipelineKey: string,
): Promise<
  Array<{
    stage: AdminWorkerPipelineStageName;
    status: AdminWorkerPipelineStageStatus | "MISSING";
    confidenceScore: number;
    qualityScore: number;
    failureReason: string | null;
    completedAt: Date | null;
  }>
> {
  const rows = await prisma.adminWorkerPipelineStage.findMany({
    where: { pipelineKey },
    orderBy: { createdAt: "asc" },
  });
  const byStage = new Map(rows.map((r) => [r.stageName, r]));
  return PIPELINE_ORDER.map((stage) => {
    const row = byStage.get(stage);
    if (!row) {
      return {
        stage,
        status: "MISSING" as const,
        confidenceScore: 0,
        qualityScore: 0,
        failureReason: null,
        completedAt: null,
      };
    }
    return {
      stage,
      status: row.status,
      confidenceScore: row.confidenceScore,
      qualityScore: row.qualityScore,
      failureReason: row.failureReason,
      completedAt: row.completedAt,
    };
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
