/**
 * Exact per-stage outcome ledger (spec: "make brain feedback exact, not
 * approximate"). The dispatcher writes one precise AdminWorkerStageOutcome
 * row for every stage it executes, so the Python brain can score future
 * actions from real outcomes instead of guessed stage-failure attribution.
 *
 * The single dispatcher choke point (executeMissionStage) calls
 * recordStageOutcome for both the success and the thrown-error path, so
 * coverage is total and uniform.
 */

import type { PrismaClient } from "@prisma/client";

import type { BrainDecision } from "./brain";
import type { DispatchOutcome } from "./dispatcher";

export interface StageOutcomeInput {
  passId?: string | null;
  stage: string;
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  contentType?: string | null;
  /** Canonical result: the dispatch kind (advanced/rejected/…/failed). */
  result: string;
  /** Coarse bucket: success / no_op / needs_repair / failure. */
  resultType: string;
  failureReason?: string | null;
  downstreamStage?: string | null;
  durationMs: number;
  confidenceBefore?: number | null;
  actualOutcome?: string | null;
  repairCreated?: boolean;
  repairPlanId?: string | null;
  nextAction?: string | null;
}

/** Coarse outcome bucket the brain learns from. */
export function resultTypeForKind(kind: DispatchOutcome["kind"]): string {
  switch (kind) {
    case "advanced":
      return "success";
    case "repair-planned":
      return "needs_repair";
    case "rejected":
    case "failed":
      return "failure";
    case "idle":
    case "skipped":
    default:
      return "no_op";
  }
}

/** Build a precise stage-outcome row from an enriched dispatch outcome. */
export function toStageOutcome(
  outcome: DispatchOutcome,
  decision: BrainDecision,
  durationMs: number,
): StageOutcomeInput {
  const repairCreated =
    outcome.kind === "repair-planned" || (outcome.repairedCount ?? outcome.repairsPlanned ?? 0) > 0;
  const entityId = outcome.outputEntity ?? outcome.inputEntity ?? null;
  const entityType = outcome.outputEntity
    ? "output_entity"
    : outcome.inputEntity
      ? "input_entity"
      : null;
  const resultType = resultTypeForKind(outcome.kind);
  const nextAction = repairCreated
    ? "execute_repair"
    : outcome.nextStage
      ? `advance_to:${outcome.nextStage}`
      : outcome.kind === "failed" || outcome.kind === "rejected"
        ? (decision.chosenAction?.fallbackAction ?? "re_plan")
        : "idle";
  return {
    passId: outcome.metadata?.passId ? String(outcome.metadata.passId) : undefined,
    stage: outcome.stage,
    action: outcome.actionTaken ?? decision.chosenAction?.actionType ?? `${outcome.stage}`,
    entityType,
    entityId,
    contentType: decision.contentType ?? decision.chosenAction?.contentType ?? null,
    result: outcome.kind,
    resultType,
    failureReason: outcome.blocker ?? null,
    downstreamStage: outcome.nextStage ?? null,
    durationMs,
    confidenceBefore: decision.confidenceScore ?? null,
    actualOutcome: outcome.summary,
    repairCreated,
    nextAction,
  };
}

export async function recordStageOutcome(
  prisma: PrismaClient,
  input: StageOutcomeInput,
): Promise<void> {
  // Best-effort: a feedback-ledger write must never break the worker —
  // a missing delegate (e.g. a partial test mock) is swallowed too, so
  // the try/catch wraps the member access, not just the promise.
  try {
    await prisma.adminWorkerStageOutcome.create({
      data: {
        passId: input.passId ?? null,
        stage: input.stage,
        action: input.action ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        contentType: input.contentType ?? null,
        result: input.result,
        resultType: input.resultType,
        failureReason: input.failureReason ?? null,
        downstreamStage: input.downstreamStage ?? null,
        durationMs: input.durationMs,
        confidenceBefore: input.confidenceBefore ?? null,
        actualOutcome: input.actualOutcome ?? null,
        repairCreated: input.repairCreated ?? false,
        repairPlanId: input.repairPlanId ?? null,
        nextAction: input.nextAction ?? null,
      },
    });
  } catch {
    /* ignore */
  }
}

export interface StageReliability {
  stage: string;
  total: number;
  successes: number;
  failures: number;
  needsRepair: number;
  successRate: number;
  avgDurationMs: number;
}

/**
 * Exact, per-stage reliability the brain consumes for scoring (replaces
 * approximate stage-failure attribution). Aggregated from the real
 * AdminWorkerStageOutcome ledger over a recent window.
 */
export async function summarizeStageReliability(
  prisma: PrismaClient,
  opts: { sinceHours?: number; limit?: number } = {},
): Promise<StageReliability[]> {
  const since = new Date(Date.now() - (opts.sinceHours ?? 24) * 3600_000);
  const rows = await prisma.adminWorkerStageOutcome
    .findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 2000,
      select: { stage: true, resultType: true, durationMs: true },
    })
    .catch(() => [] as Array<{ stage: string; resultType: string; durationMs: number }>);

  const byStage = new Map<string, StageReliability>();
  for (const r of rows) {
    const s =
      byStage.get(r.stage) ??
      ({
        stage: r.stage,
        total: 0,
        successes: 0,
        failures: 0,
        needsRepair: 0,
        successRate: 0,
        avgDurationMs: 0,
      } satisfies StageReliability);
    s.total += 1;
    if (r.resultType === "success") s.successes += 1;
    else if (r.resultType === "failure") s.failures += 1;
    else if (r.resultType === "needs_repair") s.needsRepair += 1;
    s.avgDurationMs += r.durationMs;
    byStage.set(r.stage, s);
  }
  for (const s of byStage.values()) {
    s.successRate = s.total > 0 ? s.successes / s.total : 0;
    s.avgDurationMs = s.total > 0 ? s.avgDurationMs / s.total : 0;
  }
  return [...byStage.values()].sort((a, b) => b.total - a.total);
}
